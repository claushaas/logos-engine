/** Step 8.3 — Deterministic contradiction and boundary violation detector */

import { isAbsolute, relative, resolve } from 'node:path';
import type {
	ClaimRecord,
	SourceRecord,
} from '../provenance/provenance-types.js';
import type {
	AnyRegisterItem,
	DecisionRegisterItem,
	HypothesisRegisterItem,
	OpenQuestionRegisterItem,
	RegisterCollections,
	RiskRegisterItem,
} from '../registers/register-types.js';
import {
	createValidationFinding,
	looksLikeSecretLikeValue,
	redactSecretLikeString,
	sortValidationFindings,
	type ValidationFinding,
	type ValidationFindingCode,
} from '../validation/validation-finding.js';
import {
	CONSISTENCY_RULE_ORDER,
	getConsistencyRuleById,
} from './consistency-rules.js';
import type {
	ConsistencyCheckDiagnostic,
	ConsistencyCheckInput,
	ConsistencyCheckOptions,
	ConsistencyCheckResult,
	ConsistencyGateStatus,
	ConsistencyRuleCategory,
	ConsistencyRuleId,
	ConsistencySummary,
	ConsistencyViolation,
	ExportReadinessBlocker,
	ExportReadinessStatus,
	GeneratedOutputMetadataEntry,
} from './consistency-types.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_DOCUMENTATION_ROOT = 'logos/';
const DERIVED_ARTIFACT_TYPES = new Set([
	'html',
	'agent_pack',
	'executive_json',
	'executive_markdown',
	'executive_html',
	'report',
]);

const OUT_OF_SCOPE_KEYWORDS: Array<{ term: string; category: string }> = [
	{ category: 'hosted', term: 'hosted backend' },
	{ category: 'hosted', term: 'managed database' },
	{ category: 'hosted', term: 'user accounts' },
	{ category: 'hosted', term: 'cloud workspace' },
	{ category: 'hosted', term: 'live collaboration' },
	{ category: 'hosted', term: 'profile marketplace' },
	{ category: 'sync', term: 'automatic external research' },
	{ category: 'sync', term: 'live external sync' },
	{ category: 'sync', term: 'bidirectional external sync' },
	{ category: 'hosted', term: 'notifications' },
	{ category: 'hosted', term: 'calendar workflows' },
	{ category: 'hosted', term: 'ownership assignment' },
	{ category: 'executive', term: 'live task manager' },
	{ category: 'executive', term: 'live task-management' },
];

const FUTURE_DEFERRED_KEYWORDS = [
	'future',
	'deferred',
	'planned',
	'later',
	'post-mvp',
	'roadmap',
];

const _VALIDATION_CLAIM_KEYWORDS = [
	'market demand validated',
	'pricing validated',
	'retention validated',
	'willingness to pay validated',
	'legal compliance validated',
	'security audit passed',
	'production readiness validated',
	'penetration tested',
	'SOC2 certified',
	'GDPR compliant',
	'HIPAA compliant',
];

const STALE_PROFILE_NAMES = ['app-business'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pathIsWithin(child: string, parent: string): boolean {
	const rel = relative(resolve(parent), resolve(child));
	return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

function normalizeRoot(root: string | undefined): string {
	const selected =
		root && root.trim().length > 0 ? root : DEFAULT_DOCUMENTATION_ROOT;
	return selected.endsWith('/') ? selected : `${selected}/`;
}

function hasTraversal(path: string): boolean {
	return path.split(/[\\/]+/).includes('..');
}

function nextOrder(counter: { value: number }): number {
	const current = counter.value;
	counter.value += 1;
	return current;
}

function createViolation(
	params: Omit<ConsistencyViolation, 'order'> & { order?: number },
	counter: { value: number },
): ConsistencyViolation {
	return {
		...params,
		order: params.order ?? nextOrder(counter),
	};
}

function violationToValidationFinding(
	violation: ConsistencyViolation,
): ValidationFinding {
	const code: ValidationFindingCode = `consistency_${violation.ruleId}`;
	const sourceKind =
		violation.category === 'security_boundary'
			? 'secret_scan'
			: violation.category === 'root_path'
				? 'root_path'
				: 'validation_service';

	return createValidationFinding({
		code,
		documentCanonicalId: violation.documentCanonicalId,
		expected:
			typeof violation.expected === 'string'
				? redactSecretLikeString(violation.expected)
				: violation.expected,
		location: {
			path: violation.sourcePath,
			pointer: violation.pointer,
		},
		message: violation.message,
		order: violation.order,
		phaseId: violation.phaseId,
		received:
			typeof violation.received === 'string'
				? redactSecretLikeString(violation.received)
				: violation.received,
		recoveryHint: violation.recoveryHint
			? { message: violation.recoveryHint }
			: undefined,
		severity: violation.severity,
		source: {
			kind: sourceKind,
			path: violation.sourcePath,
		},
		workspaceRecordId: violation.registerItemId,
	});
}

function getRegisterItems(
	input: ConsistencyCheckInput,
): RegisterCollections | undefined {
	return (
		input.registerCollections ??
		input.state?.registers ??
		({
			assumptions: [],
			decisions: [],
			hypotheses: [],
			lifecycleEvents: [],
			openQuestions: [],
			risks: [],
		} as RegisterCollections)
	);
}

function getProvenanceClaims(input: ConsistencyCheckInput): ClaimRecord[] {
	return (
		input.provenanceGraph?.claims ??
		input.state?.claims ??
		([] as ClaimRecord[])
	);
}

function getProvenanceSources(input: ConsistencyCheckInput): SourceRecord[] {
	return (
		input.provenanceGraph?.sources ??
		input.state?.sources ??
		([] as SourceRecord[])
	);
}

function getArtifacts(input: ConsistencyCheckInput): Array<{
	artifactId: string;
	artifactType: string;
	isCanonical?: boolean | undefined;
	path: string;
	status?: string | undefined;
	metadata?: Record<string, unknown> | undefined;
	sourceDocumentIds?: string[] | undefined;
	checksum?: string | undefined;
	generatedAt?: string | undefined;
}> {
	return input.state?.artifacts ?? [];
}

function getGeneratedOutputs(
	input: ConsistencyCheckInput,
): GeneratedOutputMetadataEntry[] {
	return input.generatedOutputs ?? [];
}

// ---------------------------------------------------------------------------
// Rule checkers
// ---------------------------------------------------------------------------

function checkRootPathConsistency(
	input: ConsistencyCheckInput,
	counter: { value: number },
): ConsistencyViolation[] {
	const violations: ConsistencyViolation[] = [];
	const root = normalizeRoot(input.documentationRoot);
	const docsRoot = resolve(input.projectRoot, root);

	// Workspace configured root vs default
	if (input.state?.documentation?.rootPath) {
		const configured = normalizeRoot(input.state.documentation.rootPath);
		if (configured === 'docs/') {
			violations.push(
				createViolation(
					{
						category: 'root_path',
						expected: DEFAULT_DOCUMENTATION_ROOT,
						message:
							'Documentation root is configured as docs/, but the default and expected root is logos/.',
						pointer: '/documentation/rootPath',
						received: configured,
						recoveryHint:
							'Use logos/ for the default documentation root, or explicitly configure a custom root.',
						ruleId: 'root_path_consistency',
						severity: 'error',
						sourcePath: input.workspacePath,
					},
					counter,
				),
			);
		}
	}

	// Artifact paths under configured root
	for (const artifact of getArtifacts(input)) {
		if (hasTraversal(artifact.path)) {
			violations.push(
				createViolation(
					{
						artifactId: artifact.artifactId,
						category: 'root_path',
						expected: 'path without .. traversal',
						message: `Artifact path contains traversal: ${artifact.path}`,
						pointer: `/artifacts/${artifact.artifactId}/path`,
						received: artifact.path,
						recoveryHint:
							'Use a project-relative path under the configured documentation root.',
						ruleId: 'root_path_consistency',
						severity: 'fatal',
						sourcePath: input.workspacePath,
					},
					counter,
				),
			);
			continue;
		}
		const resolved = resolve(input.projectRoot, artifact.path);
		if (artifact.path.startsWith('docs/') && root === normalizeRoot('logos/')) {
			violations.push(
				createViolation(
					{
						artifactId: artifact.artifactId,
						category: 'root_path',
						expected: 'path under logos/',
						message: `Artifact registry entry is under docs/ while configured root is logos/: ${artifact.path}`,
						pointer: `/artifacts/${artifact.artifactId}/path`,
						received: artifact.path,
						recoveryHint:
							'Move the artifact under logos/ or update the configured documentation root.',
						ruleId: 'root_path_consistency',
						severity: 'error',
						sourcePath: input.workspacePath,
					},
					counter,
				),
			);
		}
		if (
			!pathIsWithin(resolved, docsRoot) &&
			!pathIsWithin(resolved, input.projectRoot)
		) {
			violations.push(
				createViolation(
					{
						artifactId: artifact.artifactId,
						category: 'root_path',
						expected: `path under ${root}`,
						message: `Artifact path is outside configured documentation root and project root: ${artifact.path}`,
						pointer: `/artifacts/${artifact.artifactId}/path`,
						received: artifact.path,
						recoveryHint:
							'Move the artifact under the configured documentation root or project root.',
						ruleId: 'root_path_consistency',
						severity: 'error',
						sourcePath: input.workspacePath,
					},
					counter,
				),
			);
		}
	}

	// Generated output paths match root
	for (const output of getGeneratedOutputs(input)) {
		if (output.path?.startsWith('docs/') && root === 'logos/') {
			violations.push(
				createViolation(
					{
						category: 'root_path',
						expected: 'path under logos/',
						message: `Generated output metadata path is under docs/ while configured root is logos/: ${output.path}`,
						pointer: '/canonicalOutput',
						received: output.path,
						recoveryHint:
							'Regenerate the file under logos/ or update the configured documentation root.',
						ruleId: 'root_path_consistency',
						severity: 'error',
						sourcePath: output.path,
					},
					counter,
				),
			);
		}
	}

	return violations;
}

function checkProfileIdentityConsistency(
	input: ConsistencyCheckInput,
	counter: { value: number },
): ConsistencyViolation[] {
	const violations: ConsistencyViolation[] = [];
	const activeProfile = input.profileId;

	// Workspace profile lock mismatch
	if (input.state?.profile?.profileId) {
		if (input.state.profile.profileId !== activeProfile) {
			violations.push(
				createViolation(
					{
						category: 'profile_identity',
						expected: activeProfile,
						message: `Workspace profile lock (${input.state.profile.profileId}) does not match active profile (${activeProfile}).`,
						pointer: '/profile/profileId',
						received: input.state.profile.profileId,
						recoveryHint:
							'Validate the locked profile or update the workspace through supported initialization flows.',
						ruleId: 'profile_identity_consistency',
						severity: 'error',
						sourcePath: input.workspacePath,
					},
					counter,
				),
			);
		}
	}

	// Generated output metadata profile mismatch
	for (const output of getGeneratedOutputs(input)) {
		if (output.profileId && output.profileId !== activeProfile) {
			violations.push(
				createViolation(
					{
						category: 'profile_identity',
						documentCanonicalId: output.documentId,
						expected: activeProfile,
						message: `Generated output metadata profileId (${output.profileId}) does not match active profile (${activeProfile}).`,
						pointer: '/profileId',
						received: output.profileId,
						recoveryHint:
							'Regenerate canonical Markdown with the active profile.',
						ruleId: 'profile_identity_consistency',
						severity: 'error',
						sourcePath: output.path,
					},
					counter,
				),
			);
		}
	}

	// Artifact registry profile metadata mismatch
	for (const artifact of getArtifacts(input)) {
		const artProfile = artifact.metadata?.profileId;
		if (typeof artProfile === 'string' && artProfile !== activeProfile) {
			violations.push(
				createViolation(
					{
						artifactId: artifact.artifactId,
						category: 'profile_identity',
						expected: activeProfile,
						message: `Artifact registry entry profile metadata (${artProfile}) does not match active profile (${activeProfile}).`,
						pointer: `/artifacts/${artifact.artifactId}/metadata/profileId`,
						received: artProfile,
						recoveryHint:
							'Update artifact metadata or regenerate with the active profile.',
						ruleId: 'profile_identity_consistency',
						severity: 'warning',
						sourcePath: input.workspacePath,
					},
					counter,
				),
			);
		}
	}

	return violations;
}

function checkCanonicalSourceOfTruthBoundary(
	input: ConsistencyCheckInput,
	counter: { value: number },
): ConsistencyViolation[] {
	const violations: ConsistencyViolation[] = [];

	for (const artifact of getArtifacts(input)) {
		if (
			artifact.artifactType === 'canonical_markdown' &&
			artifact.isCanonical !== true
		) {
			violations.push(
				createViolation(
					{
						artifactId: artifact.artifactId,
						category: 'source_of_truth',
						expected: true,
						message: `Canonical Markdown artifact (${artifact.artifactId}) is not marked canonical in registry.`,
						pointer: `/artifacts/${artifact.artifactId}/isCanonical`,
						received: artifact.isCanonical,
						recoveryHint:
							'Mark canonical Markdown artifact records as canonical.',
						ruleId: 'canonical_source_of_truth_boundary',
						severity: 'error',
						sourcePath: input.workspacePath,
					},
					counter,
				),
			);
		}
		if (
			DERIVED_ARTIFACT_TYPES.has(artifact.artifactType) &&
			artifact.isCanonical
		) {
			violations.push(
				createViolation(
					{
						artifactId: artifact.artifactId,
						category: 'source_of_truth',
						expected: false,
						message: `Derived artifact (${artifact.artifactType}) must not be marked canonical: ${artifact.artifactId}`,
						pointer: `/artifacts/${artifact.artifactId}/isCanonical`,
						received: artifact.isCanonical,
						recoveryHint: 'Mark derived artifact records as non-canonical.',
						ruleId: 'canonical_source_of_truth_boundary',
						severity: 'error',
						sourcePath: input.workspacePath,
					},
					counter,
				),
			);
		}
	}

	return violations;
}

function checkDerivedArtifactBoundary(
	input: ConsistencyCheckInput,
	counter: { value: number },
): ConsistencyViolation[] {
	const violations: ConsistencyViolation[] = [];

	// Derived artifact used as source for canonical Markdown
	const canonicalArtifacts = getArtifacts(input).filter(
		(a) => a.artifactType === 'canonical_markdown',
	);
	for (const canonical of canonicalArtifacts) {
		for (const _docId of canonical.sourceDocumentIds ?? []) {
			// If a derived artifact claims to be a source for canonical, that's a finding
			// We check generated outputs for this claim
		}
	}

	for (const output of getGeneratedOutputs(input)) {
		if (
			DERIVED_ARTIFACT_TYPES.has(output.artifactType ?? '') &&
			output.isCanonical
		) {
			violations.push(
				createViolation(
					{
						category: 'artifact_boundary',
						documentCanonicalId: output.documentId,
						expected: false,
						message: `Generated output metadata marks derived artifact (${output.artifactType}) as canonical.`,
						pointer: '/isCanonical',
						received: output.isCanonical,
						recoveryHint: 'Mark derived artifact metadata as non-canonical.',
						ruleId: 'derived_artifact_boundary',
						severity: 'error',
						sourcePath: output.path,
					},
					counter,
				),
			);
		}
	}

	return violations;
}

function checkValidationOverclaimBoundary(
	input: ConsistencyCheckInput,
	counter: { value: number },
): ConsistencyViolation[] {
	const violations: ConsistencyViolation[] = [];
	const registers = getRegisterItems(input);

	// Hypotheses marked validated without evidence sources
	if (registers) {
		for (const h of registers.hypotheses) {
			if (h.status === 'validated') {
				const hasEvidence =
					(h as HypothesisRegisterItem).evidenceSourceIds &&
					(h as HypothesisRegisterItem).evidenceSourceIds?.length > 0;
				if (!hasEvidence) {
					violations.push(
						createViolation(
							{
								category: 'validation_claim',
								expected: 'evidenceSourceIds with at least one source',
								message: `Hypothesis "${h.title}" is marked validated without evidence source links.`,
								pointer: `/registers/hypotheses/${h.id}`,
								received: (h as HypothesisRegisterItem).evidenceSourceIds,
								recoveryHint:
									'Link evidence sources to the hypothesis or change status to active/inconclusive.',
								registerItemId: h.id,
								ruleId: 'validation_overclaim_boundary',
								severity: 'error',
								sourcePath: input.workspacePath,
							},
							counter,
						),
					);
				}
			}
		}
	}

	// Provenance claims that are validation claims without sources
	for (const claim of getProvenanceClaims(input)) {
		if (
			claim.claimType === 'validation_claim' &&
			claim.status === 'confirmed'
		) {
			if (!claim.sourceLinks || claim.sourceLinks.length === 0) {
				violations.push(
					createViolation(
						{
							category: 'validation_claim',
							claimId: claim.claimId,
							expected: 'at least one source link',
							message: `Validation claim "${claim.summary}" is confirmed without supporting sources.`,
							pointer: `/claims/${claim.claimId}`,
							received: claim.sourceLinks.length,
							recoveryHint:
								'Add supporting evidence sources or change claim status to requires_review.',
							ruleId: 'validation_overclaim_boundary',
							severity: 'error',
							sourcePath: input.workspacePath,
						},
						counter,
					),
				);
			}
		}
	}

	// Validation passed claim without validation run evidence
	if (input.state?.validationRuns) {
		const hasPassedRun = input.state.validationRuns.some(
			(r) => r.status === 'passed' || r.status === 'pass_with_warnings',
		);
		for (const output of getGeneratedOutputs(input)) {
			if (
				output.generationStatus &&
				/validation\s*(passed|true)/i.test(output.generationStatus) &&
				!hasPassedRun
			) {
				violations.push(
					createViolation(
						{
							category: 'validation_claim',
							documentCanonicalId: output.documentId,
							expected:
								'validation run record with passed/pass_with_warnings status',
							message: `Generated output metadata claims validation passed without persisted validation run evidence.`,
							pointer: '/generationStatus',
							received: output.generationStatus,
							recoveryHint:
								'Run /validate to produce a validation run record, or remove the validation-passed claim.',
							ruleId: 'validation_overclaim_boundary',
							severity: 'warning',
							sourcePath: output.path,
						},
						counter,
					),
				);
			}
		}
	}

	return violations;
}

function checkHostedSaaSScopeBoundary(
	input: ConsistencyCheckInput,
	counter: { value: number },
): ConsistencyViolation[] {
	const violations: ConsistencyViolation[] = [];
	const registers = getRegisterItems(input);

	function isCurrentOrMvpClaim(text: string): boolean {
		const lower = text.toLowerCase();
		if (FUTURE_DEFERRED_KEYWORDS.some((kw) => lower.includes(kw))) return false;
		return (
			/mvp/i.test(lower) ||
			/current/i.test(lower) ||
			/implemented/i.test(lower) ||
			/now/i.test(lower)
		);
	}

	if (registers) {
		for (const item of [...registers.decisions, ...registers.assumptions]) {
			if (item.status !== 'confirmed') continue;
			const text =
				(item as DecisionRegisterItem).decisionStatement ??
				(item as AnyRegisterItem).title ??
				'';
			for (const kw of OUT_OF_SCOPE_KEYWORDS) {
				if (text.toLowerCase().includes(kw.term)) {
					if (isCurrentOrMvpClaim(text)) {
						violations.push(
							createViolation(
								{
									category: 'scope_boundary',
									expected: 'future/deferred/planned mention',
									message: `Register item "${item.title}" claims ${kw.term} as MVP/current, which is out of current scope.`,
									pointer: `/registers/${item.kind}/${item.id}`,
									received: text.slice(0, 200),
									recoveryHint:
										'Rephrase as future/deferred or remove the out-of-scope claim.',
									registerItemId: item.id,
									ruleId: 'hosted_saas_scope_boundary',
									severity: 'error',
									sourcePath: input.workspacePath,
								},
								counter,
							),
						);
					}
				}
			}
		}
	}

	// Check provenance claims
	for (const claim of getProvenanceClaims(input)) {
		if (claim.status !== 'confirmed') continue;
		const text = claim.summary.toLowerCase();
		for (const kw of OUT_OF_SCOPE_KEYWORDS) {
			if (text.includes(kw.term)) {
				if (isCurrentOrMvpClaim(claim.summary)) {
					violations.push(
						createViolation(
							{
								category: 'scope_boundary',
								claimId: claim.claimId,
								expected: 'future/deferred/planned mention',
								message: `Claim "${claim.summary}" claims ${kw.term} as MVP/current, which is out of scope.`,
								pointer: `/claims/${claim.claimId}`,
								received: claim.summary.slice(0, 200),
								recoveryHint:
									'Rephrase as future/deferred or remove the out-of-scope claim.',
								ruleId: 'hosted_saas_scope_boundary',
								severity: 'error',
								sourcePath: input.workspacePath,
							},
							counter,
						),
					);
				}
			}
		}
	}

	return violations;
}

function checkExternalSyncScopeBoundary(
	input: ConsistencyCheckInput,
	counter: { value: number },
): ConsistencyViolation[] {
	const violations: ConsistencyViolation[] = [];
	const registers = getRegisterItems(input);

	function isCurrentOrMvpClaim(text: string): boolean {
		const lower = text.toLowerCase();
		if (FUTURE_DEFERRED_KEYWORDS.some((kw) => lower.includes(kw))) return false;
		return (
			/mvp/i.test(lower) || /current/i.test(lower) || /implemented/i.test(lower)
		);
	}

	const syncTerms = [
		'live external sync',
		'bidirectional sync',
		'real-time collaboration',
		'live task manager',
		'live task-management',
	];

	if (registers) {
		for (const item of [...registers.decisions, ...registers.assumptions]) {
			if (item.status !== 'confirmed') continue;
			const text =
				(item as DecisionRegisterItem).decisionStatement ??
				(item as AnyRegisterItem).title ??
				'';
			for (const term of syncTerms) {
				if (text.toLowerCase().includes(term)) {
					if (isCurrentOrMvpClaim(text)) {
						violations.push(
							createViolation(
								{
									category: 'scope_boundary',
									expected: 'future/deferred/planned adapter contract',
									message: `Register item "${item.title}" claims ${term} as implemented/MVP, which is out of current scope.`,
									pointer: `/registers/${item.kind}/${item.id}`,
									received: text.slice(0, 200),
									recoveryHint:
										'Describe sync as planned/deferred, not implemented MVP.',
									registerItemId: item.id,
									ruleId: 'external_sync_scope_boundary',
									severity: 'error',
									sourcePath: input.workspacePath,
								},
								counter,
							),
						);
					}
				}
			}
		}
	}

	return violations;
}

function checkTokenStorageBoundary(
	input: ConsistencyCheckInput,
	counter: { value: number },
): ConsistencyViolation[] {
	const violations: ConsistencyViolation[] = [];

	function scanValue(
		value: unknown,
		basePath: string,
		basePointer: string,
	): void {
		if (typeof value === 'string') {
			if (looksLikeSecretLikeValue(value)) {
				violations.push(
					createViolation(
						{
							category: 'security_boundary',
							expected: 'environment variable name or redacted metadata',
							message: `Raw secret-like value found in ${basePath}.`,
							pointer: basePointer,
							received: redactSecretLikeString(value),
							recoveryHint:
								'Replace raw token-like values with environment variable names such as OPENAI_API_KEY.',
							ruleId: 'token_storage_boundary',
							severity: 'error',
							sourcePath: basePath,
						},
						counter,
					),
				);
			}
			return;
		}
		if (Array.isArray(value)) {
			value.forEach((item, index) => {
				scanValue(item, basePath, `${basePointer}/${index}`);
			});
			return;
		}
		if (value !== null && typeof value === 'object') {
			for (const [key, item] of Object.entries(
				value as Record<string, unknown>,
			)) {
				const lowerKey = key.toLowerCase();
				if (lowerKey === 'checksum' || lowerKey === 'contentchecksum') continue;
				scanValue(item, basePath, `${basePointer}/${key}`);
			}
		}
	}

	// Scan workspace state (excluding checksum fields)
	if (input.state) {
		const stateCopy = { ...input.state };
		scanValue(stateCopy, input.workspacePath ?? input.projectRoot, '/state');
	}

	// Scan register collections
	const registers = getRegisterItems(input);
	if (registers) {
		scanValue(
			registers,
			input.workspacePath ?? input.projectRoot,
			'/registers',
		);
	}

	// Scan provenance
	if (input.provenanceGraph) {
		scanValue(
			input.provenanceGraph,
			input.workspacePath ?? input.projectRoot,
			'/provenance',
		);
	}

	// Scan generated outputs
	for (const output of getGeneratedOutputs(input)) {
		scanValue(output, output.path ?? input.projectRoot, '/generatedOutput');
	}

	return violations;
}

function checkAiAuthorityBoundary(
	input: ConsistencyCheckInput,
	counter: { value: number },
): ConsistencyViolation[] {
	const violations: ConsistencyViolation[] = [];
	const registers = getRegisterItems(input);

	// Proposals with AI source that became confirmed without explicit acceptance
	if (input.state?.proposals) {
		for (const proposal of input.state.proposals) {
			if (proposal.status === 'confirmed' || proposal.status === 'accepted') {
				const hasAiSource =
					(proposal as Record<string, unknown>).sourceAnswerId !== undefined ||
					(proposal as Record<string, unknown>).extractionMetadata !==
						undefined;
				if (hasAiSource) {
					violations.push(
						createViolation(
							{
								category: 'security_boundary',
								expected: 'explicit acceptance lifecycle event',
								message: `Proposal ${proposal.proposalId} with AI source is treated as confirmed without explicit acceptance lifecycle event.`,
								pointer: `/proposals/${proposal.proposalId}`,
								received: proposal.status,
								recoveryHint:
									'Add an explicit acceptance/confirmation lifecycle event before treating AI proposals as confirmed.',
								ruleId: 'ai_authority_boundary',
								severity: 'error',
								sourcePath: input.workspacePath,
							},
							counter,
						),
					);
				}
			}
		}
	}

	// Claims with inferred confidence that are confirmed
	for (const claim of getProvenanceClaims(input)) {
		if (claim.status === 'confirmed' && claim.confidence === 'inferred') {
			violations.push(
				createViolation(
					{
						category: 'security_boundary',
						claimId: claim.claimId,
						expected: 'explicit or derived confidence for confirmed claims',
						message: `Claim "${claim.summary}" is confirmed with inferred confidence.`,
						pointer: `/claims/${claim.claimId}`,
						received: claim.confidence,
						recoveryHint:
							'Review inferred claims before confirming, or change status to requires_review.',
						ruleId: 'ai_authority_boundary',
						severity: 'error',
						sourcePath: input.workspacePath,
					},
					counter,
				),
			);
		}
	}

	// Register items with inferred confidence that are confirmed
	if (registers) {
		for (const item of [...registers.decisions, ...registers.assumptions]) {
			if (item.status === 'confirmed' && item.confidence === 'inferred') {
				violations.push(
					createViolation(
						{
							category: 'security_boundary',
							expected: 'explicit confidence for confirmed items',
							message: `Register item "${item.title}" (${item.kind}) is confirmed with inferred confidence.`,
							pointer: `/registers/${item.kind}/${item.id}`,
							received: item.confidence,
							recoveryHint:
								'Confirm with explicit evidence or change confidence to explicit.',
							registerItemId: item.id,
							ruleId: 'ai_authority_boundary',
							severity: 'error',
							sourcePath: input.workspacePath,
						},
						counter,
					),
				);
			}
		}
	}

	return violations;
}

function checkUnresolvedQuestionVisibility(
	input: ConsistencyCheckInput,
	counter: { value: number },
): ConsistencyViolation[] {
	const violations: ConsistencyViolation[] = [];
	const registers = getRegisterItems(input);

	if (!registers) return violations;

	const blockingOpen = registers.openQuestions.filter(
		(q) => q.status === 'open' && q.isBlocking,
	);

	// Documents claiming complete when blocking questions exist
	if (blockingOpen.length > 0) {
		for (const docId of new Set(
			blockingOpen.flatMap((q) =>
				q.affectedDocumentLinks.map((l) => l.documentCanonicalId),
			),
		)) {
			violations.push(
				createViolation(
					{
						category: 'register_state',
						documentCanonicalId: docId,
						expected:
							'no blocking open questions or explicit incomplete status',
						message: `Document ${docId} has blocking open questions but may claim completeness.`,
						pointer: `/registers/openQuestions`,
						received: `${blockingOpen.length} blocking open question(s)`,
						recoveryHint:
							'Resolve blocking open questions or mark the document as incomplete/blocked.',
						ruleId: 'unresolved_question_visibility',
						severity: 'warning',
						sourcePath: input.workspacePath,
					},
					counter,
				),
			);
		}
	}

	// Resolved questions without resolution source
	for (const q of registers.openQuestions) {
		if (q.status === 'resolved') {
			const oq = q as OpenQuestionRegisterItem;
			const hasResolution =
				oq.resolutionSummary ||
				oq.resolvedByDecisionId ||
				oq.resolvedByClaimId ||
				oq.resolvedBySourceId;
			if (!hasResolution) {
				violations.push(
					createViolation(
						{
							category: 'register_state',
							expected:
								'resolutionSummary, resolvedByDecisionId, or resolvedBySourceId',
							message: `Open question "${q.title}" is marked resolved without a resolution summary or source.`,
							pointer: `/registers/openQuestions/${q.id}`,
							received: 'none',
							recoveryHint:
								'Add a resolution summary or link the resolving decision/source.',
							registerItemId: q.id,
							ruleId: 'unresolved_question_visibility',
							severity: 'warning',
							sourcePath: input.workspacePath,
						},
						counter,
					),
				);
			}
		}
	}

	// Generation report missing unresolved question count
	if (input.generationReport) {
		const reportBlockingCount =
			input.generationReport.unresolvedBlockingQuestionCount;
		if (
			reportBlockingCount === undefined &&
			registers.openQuestions.some((q) => q.status === 'open')
		) {
			violations.push(
				createViolation(
					{
						category: 'register_state',
						expected: 'unresolvedBlockingQuestionCount field',
						message:
							'Generation report is missing unresolved blocking question count while open questions exist.',
						pointer: '/generationReport',
						received: undefined,
						recoveryHint:
							'Include unresolved blocking question count in generation reports.',
						ruleId: 'unresolved_question_visibility',
						severity: 'info',
						sourcePath: input.workspacePath,
					},
					counter,
				),
			);
		}
	}

	return violations;
}

function checkRegisterLifecycleConsistency(
	input: ConsistencyCheckInput,
	counter: { value: number },
): ConsistencyViolation[] {
	const violations: ConsistencyViolation[] = [];
	const registers = getRegisterItems(input);
	if (!registers) return violations;

	// Valid transitions map
	const validTransitions: Record<string, Set<string>> = {
		assumption: new Set([
			'proposed->confirmed',
			'proposed->rejected',
			'proposed->superseded',
			'confirmed->superseded',
		]),
		decision: new Set([
			'proposed->confirmed',
			'proposed->rejected',
			'proposed->superseded',
			'confirmed->superseded',
		]),
		hypothesis: new Set([
			'proposed->active',
			'proposed->rejected',
			'proposed->superseded',
			'active->validated',
			'active->invalidated',
			'active->inconclusive',
			'active->superseded',
			'validated->superseded',
			'invalidated->superseded',
			'inconclusive->superseded',
		]),
		open_question: new Set([
			'open->resolved',
			'open->rejected',
			'open->superseded',
			'resolved->superseded',
		]),
		risk: new Set([
			'proposed->accepted',
			'proposed->rejected',
			'proposed->superseded',
			'accepted->mitigated',
			'accepted->resolved',
			'accepted->superseded',
			'mitigated->resolved',
			'mitigated->superseded',
			'resolved->superseded',
		]),
	};

	function getKind(item: AnyRegisterItem): string {
		return item.kind;
	}

	for (const item of [
		...registers.decisions,
		...registers.assumptions,
		...registers.hypotheses,
		...registers.risks,
		...registers.openQuestions,
	]) {
		const kind = getKind(item);
		const history = item.lifecycleHistory ?? [];
		for (let i = 0; i < history.length; i++) {
			const event = history[i];
			if (!event) continue;
			const from = event.fromStatus ?? '';
			const to = event.toStatus ?? '';
			if (from && to) {
				const transition = `${from}->${to}`;
				const allowed = validTransitions[kind];
				if (allowed && !allowed.has(transition)) {
					violations.push(
						createViolation(
							{
								category: 'register_state',
								expected: `one of ${Array.from(allowed ?? []).join(', ')}`,
								message: `Invalid lifecycle transition for ${kind} "${item.title}": ${from} -> ${to}.`,
								pointer: `/registers/${kind}/${item.id}/lifecycleHistory/${i}`,
								received: transition,
								recoveryHint:
									'Use a valid lifecycle transition for this register kind.',
								registerItemId: item.id,
								ruleId: 'register_lifecycle_consistency',
								severity: 'error',
								sourcePath: input.workspacePath,
							},
							counter,
						),
					);
				}
			}
		}

		// Rejected/superseded items used as active sources
		if (item.status === 'rejected' || item.status === 'superseded') {
			if (item.sourceLinks && item.sourceLinks.length > 0) {
				// Not necessarily a violation if they are historical links
			}
		}

		// Confirmed decisions without sources
		if (kind === 'decision' && item.status === 'confirmed') {
			if (!item.sourceLinks || item.sourceLinks.length === 0) {
				violations.push(
					createViolation(
						{
							category: 'register_state',
							expected: 'at least one source link',
							message: `Confirmed decision "${item.title}" has no linked sources.`,
							pointer: `/registers/decisions/${item.id}/sourceLinks`,
							received: 0,
							recoveryHint:
								'Link supporting sources to the confirmed decision.',
							registerItemId: item.id,
							ruleId: 'register_lifecycle_consistency',
							severity: 'warning',
							sourcePath: input.workspacePath,
						},
						counter,
					),
				);
			}
		}
	}

	return violations;
}

function checkRiskAcceptanceConsistency(
	input: ConsistencyCheckInput,
	counter: { value: number },
): ConsistencyViolation[] {
	const violations: ConsistencyViolation[] = [];
	const registers = getRegisterItems(input);
	if (!registers) return violations;

	for (const risk of registers.risks) {
		if (risk.status === 'accepted') {
			const r = risk as RiskRegisterItem;
			const hasMitigation =
				r.mitigation && String(r.mitigation).trim().length > 0;
			const hasReviewNote = r.lifecycleHistory?.some(
				(e) =>
					e.eventType === 'review_approved' || e.eventType === 'review_started',
			);
			if (!hasMitigation && !hasReviewNote) {
				violations.push(
					createViolation(
						{
							category: 'register_state',
							expected: 'mitigation plan or review lifecycle event',
							message: `Accepted risk "${risk.title}" lacks mitigation or review note.`,
							pointer: `/registers/risks/${risk.id}`,
							received: 'none',
							recoveryHint:
								'Add a mitigation plan or record a review lifecycle event.',
							registerItemId: risk.id,
							ruleId: 'risk_acceptance_consistency',
							severity: 'warning',
							sourcePath: input.workspacePath,
						},
						counter,
					),
				);
			}
		}
		if (risk.status === 'resolved') {
			const relatedOpen = registers.openQuestions.filter(
				(q) =>
					q.status === 'open' &&
					q.isBlocking &&
					(risk as RiskRegisterItem).relatedOpenQuestionIds?.includes(q.id),
			);
			if (relatedOpen.length > 0) {
				violations.push(
					createViolation(
						{
							category: 'register_state',
							expected:
								'no active blocking open questions linked to resolved risk',
							message: `Resolved risk "${risk.title}" has active blocking open questions indicating it may still be unresolved.`,
							pointer: `/registers/risks/${risk.id}`,
							received: `${relatedOpen.length} blocking open question(s)`,
							recoveryHint:
								'Resolve the linked open questions before marking the risk resolved.',
							registerItemId: risk.id,
							ruleId: 'risk_acceptance_consistency',
							severity: 'error',
							sourcePath: input.workspacePath,
						},
						counter,
					),
				);
			}
		}
	}

	return violations;
}

function checkHypothesisEvidenceConsistency(
	input: ConsistencyCheckInput,
	counter: { value: number },
): ConsistencyViolation[] {
	const violations: ConsistencyViolation[] = [];
	const registers = getRegisterItems(input);
	if (!registers) return violations;

	for (const h of registers.hypotheses) {
		if (h.status === 'validated') {
			const hyp = h as HypothesisRegisterItem;
			if (!hyp.evidenceSourceIds || hyp.evidenceSourceIds.length === 0) {
				violations.push(
					createViolation(
						{
							category: 'validation_claim',
							expected: 'evidenceSourceIds with at least one source',
							message: `Validated hypothesis "${h.title}" has no evidence source links.`,
							pointer: `/registers/hypotheses/${h.id}`,
							received: hyp.evidenceSourceIds,
							recoveryHint:
								'Link evidence sources or change status to active/inconclusive.',
							registerItemId: h.id,
							ruleId: 'hypothesis_evidence_consistency',
							severity: 'error',
							sourcePath: input.workspacePath,
						},
						counter,
					),
				);
			}
		}
		if (h.status === 'invalidated') {
			const hyp = h as HypothesisRegisterItem;
			const hasReasoning = hyp.lifecycleHistory?.some(
				(e) => e.notes && String(e.notes).trim().length > 0,
			);
			if (!hasReasoning) {
				violations.push(
					createViolation(
						{
							category: 'validation_claim',
							expected: 'lifecycle event with notes explaining invalidation',
							message: `Invalidated hypothesis "${h.title}" lacks reasoning in lifecycle history.`,
							pointer: `/registers/hypotheses/${h.id}`,
							received: 'none',
							recoveryHint:
								'Add invalidation reasoning to the hypothesis lifecycle history.',
							registerItemId: h.id,
							ruleId: 'hypothesis_evidence_consistency',
							severity: 'warning',
							sourcePath: input.workspacePath,
						},
						counter,
					),
				);
			}
		}
	}

	return violations;
}

function checkExecutiveAxisScopeBoundary(
	input: ConsistencyCheckInput,
	counter: { value: number },
): ConsistencyViolation[] {
	const violations: ConsistencyViolation[] = [];
	const registers = getRegisterItems(input);

	// Check register items that claim executive axis is a live task manager
	if (registers) {
		for (const item of [...registers.decisions, ...registers.assumptions]) {
			if (item.status !== 'confirmed') continue;
			const text =
				(item as DecisionRegisterItem).decisionStatement ??
				(item as AnyRegisterItem).title ??
				'';
			const lower = text.toLowerCase();
			if (
				lower.includes('live task manager') ||
				lower.includes('live task-management') ||
				lower.includes('bidirectional sync')
			) {
				violations.push(
					createViolation(
						{
							category: 'executive_scope',
							expected: 'portable JSON/derived export description',
							message: `Register item "${item.title}" claims Executive Axis live task manager or bidirectional sync behavior, which is out of scope.`,
							pointer: `/registers/${item.kind}/${item.id}`,
							received: text.slice(0, 200),
							recoveryHint:
								'Describe Executive Axis as a derived export snapshot, not a live task manager.',
							registerItemId: item.id,
							ruleId: 'executive_axis_scope_boundary',
							severity: 'error',
							sourcePath: input.workspacePath,
						},
						counter,
					),
				);
			}
		}
	}

	// Check if release-blocking normative contradictions should block executive readiness
	const existingBlocking =
		input.existingFindings?.filter(
			(f) =>
				(f.severity === 'fatal' || f.severity === 'error') &&
				f.code.startsWith('consistency_'),
		) ?? [];
	if (existingBlocking.length > 0) {
		violations.push(
			createViolation(
				{
					category: 'executive_scope',
					expected:
						'no release-blocking consistency findings before executive export',
					message: `Executive export readiness is affected by ${existingBlocking.length} release-blocking consistency finding(s).`,
					pointer: '/consistencyFindings',
					received: `${existingBlocking.length} blocking finding(s)`,
					recoveryHint:
						'Resolve release-blocking consistency findings before executive export.',
					ruleId: 'executive_axis_scope_boundary',
					severity: 'warning',
					sourcePath: input.workspacePath,
				},
				counter,
			),
		);
	}

	return violations;
}

function checkReadmeProfileDrift(
	input: ConsistencyCheckInput,
	counter: { value: number },
): ConsistencyViolation[] {
	const violations: ConsistencyViolation[] = [];
	if (!input.readmeMetadata) return violations;

	const snippet = input.readmeMetadata.contentSnippet ?? '';
	const profileRef = input.readmeMetadata.profileReference ?? '';

	for (const staleName of STALE_PROFILE_NAMES) {
		if (profileRef.toLowerCase().includes(staleName)) {
			violations.push(
				createViolation(
					{
						category: 'profile_identity',
						expected: 'active profile name (standard)',
						message: `README references stale profile name "${staleName}".`,
						pointer: '/profileReference',
						received: staleName,
						recoveryHint: 'Update README to reference the active profile name.',
						ruleId: 'readme_profile_drift',
						severity: 'warning',
						sourcePath: 'README.md',
					},
					counter,
				),
			);
		}
		if (snippet.toLowerCase().includes(staleName)) {
			violations.push(
				createViolation(
					{
						category: 'profile_identity',
						expected: 'active profile name (standard)',
						message: `README content snippet references stale profile name "${staleName}".`,
						pointer: '/content',
						received: snippet.slice(0, 200),
						recoveryHint: 'Update README to reference the active profile name.',
						ruleId: 'readme_profile_drift',
						severity: 'warning',
						sourcePath: 'README.md',
					},
					counter,
				),
			);
		}
	}

	return violations;
}

function checkGeneratedOutputMetadataConsistency(
	input: ConsistencyCheckInput,
	counter: { value: number },
): ConsistencyViolation[] {
	const violations: ConsistencyViolation[] = [];
	const contractDocs = input.contract?.documentsByCanonicalId;

	for (const output of getGeneratedOutputs(input)) {
		// Document ID mismatch
		if (output.documentId && contractDocs) {
			const contractDoc = contractDocs.get(output.documentId);
			if (!contractDoc) {
				violations.push(
					createViolation(
						{
							category: 'generation_readiness',
							documentCanonicalId: output.documentId,
							expected: 'known contract document ID',
							message: `Generated output metadata documentId "${output.documentId}" does not exist in the active contract.`,
							pointer: '/documentId',
							received: output.documentId,
							recoveryHint:
								'Regenerate from the active contract or fix stale metadata.',
							ruleId: 'generated_output_metadata_consistency',
							severity: 'error',
							sourcePath: output.path,
						},
						counter,
					),
				);
			}
		}

		// Phase ID mismatch
		if (output.phaseId && output.documentId && contractDocs) {
			const contractDoc = contractDocs.get(output.documentId);
			if (contractDoc && contractDoc.phaseId !== output.phaseId) {
				violations.push(
					createViolation(
						{
							category: 'generation_readiness',
							documentCanonicalId: output.documentId,
							expected: contractDoc.phaseId,
							message: `Generated output metadata phaseId "${output.phaseId}" does not match contract phase for document ${output.documentId}.`,
							phaseId: output.phaseId,
							pointer: '/phaseId',
							received: output.phaseId,
							recoveryHint: 'Regenerate the file from the active contract.',
							ruleId: 'generated_output_metadata_consistency',
							severity: 'error',
							sourcePath: output.path,
						},
						counter,
					),
				);
			}
		}

		// Canonical output path mismatch
		if (output.canonicalOutput && output.documentId && contractDocs) {
			const contractDoc = contractDocs.get(output.documentId);
			const expectedPath = contractDoc?.descriptor?.outputs?.canonical?.path;
			if (expectedPath && output.canonicalOutput !== expectedPath) {
				violations.push(
					createViolation(
						{
							category: 'generation_readiness',
							documentCanonicalId: output.documentId,
							expected: expectedPath,
							message: `Generated output metadata canonicalOutput "${output.canonicalOutput}" does not match contract expected path.`,
							pointer: '/canonicalOutput',
							received: output.canonicalOutput,
							recoveryHint: 'Regenerate after resolving path metadata drift.',
							ruleId: 'generated_output_metadata_consistency',
							severity: 'error',
							sourcePath: output.path,
						},
						counter,
					),
				);
			}
		}

		// Derived artifact marked canonical
		if (
			DERIVED_ARTIFACT_TYPES.has(output.artifactType ?? '') &&
			output.isCanonical
		) {
			violations.push(
				createViolation(
					{
						category: 'generation_readiness',
						documentCanonicalId: output.documentId,
						expected: false,
						message: `Generated output metadata marks derived artifact (${output.artifactType}) as canonical.`,
						pointer: '/isCanonical',
						received: output.isCanonical,
						recoveryHint: 'Mark derived artifact metadata as non-canonical.',
						ruleId: 'generated_output_metadata_consistency',
						severity: 'error',
						sourcePath: output.path,
					},
					counter,
				),
			);
		}
	}

	// Stale/orphaned outputs treated as current/ready
	const staleIds = input.dependencyGraphSummary?.staleDocumentIds ?? [];
	for (const output of getGeneratedOutputs(input)) {
		if (
			output.documentId &&
			staleIds.includes(output.documentId) &&
			output.generationStatus === 'generated'
		) {
			violations.push(
				createViolation(
					{
						category: 'generation_readiness',
						documentCanonicalId: output.documentId,
						expected: 'stale or blocked status',
						message: `Generated output for document ${output.documentId} is stale but marked as generated.`,
						pointer: '/generationStatus',
						received: output.generationStatus,
						recoveryHint:
							'Regenerate the document or mark it stale in metadata.',
						ruleId: 'generated_output_metadata_consistency',
						severity: 'warning',
						sourcePath: output.path,
					},
					counter,
				),
			);
		}
	}

	return violations;
}

function checkRegisterContradictions(
	input: ConsistencyCheckInput,
	counter: { value: number },
): ConsistencyViolation[] {
	const violations: ConsistencyViolation[] = [];
	const registers = getRegisterItems(input);
	if (!registers) return violations;

	// Two confirmed active decisions with same affected document and contradictory statements
	const confirmedDecisions = registers.decisions.filter(
		(d) => d.status === 'confirmed',
	);
	for (let i = 0; i < confirmedDecisions.length; i++) {
		const d1 = confirmedDecisions[i];
		if (!d1) continue;
		const docs1 = new Set(
			d1.affectedDocumentLinks.map((l) => l.documentCanonicalId),
		);
		for (let j = i + 1; j < confirmedDecisions.length; j++) {
			const d2 = confirmedDecisions[j];
			if (!d2) continue;
			const docs2 = new Set(
				d2.affectedDocumentLinks.map((l) => l.documentCanonicalId),
			);
			const sharedDoc = [...docs1].find((id) => docs2.has(id));
			if (!sharedDoc) continue;

			const s1 = (d1.decisionStatement ?? d1.title).toLowerCase().trim();
			const s2 = (d2.decisionStatement ?? d2.title).toLowerCase().trim();

			// Explicit contradiction: one is exact negation of the other
			const negationPatterns = [
				s1.replace(/\bnot\s+/g, '') === s2,
				s2.replace(/\bnot\s+/g, '') === s1,
				s1.includes('do not') && s2.includes('do ') && !s2.includes('do not'),
				s2.includes('do not') && s1.includes('do ') && !s1.includes('do not'),
			];

			if (negationPatterns.some(Boolean)) {
				violations.push(
					createViolation(
						{
							category: 'register_state',
							documentCanonicalId: sharedDoc,
							expected: 'consistent confirmed decisions for the same document',
							message: `Confirmed decisions "${d1.title}" and "${d2.title}" have explicit contradictory statements for document ${sharedDoc}.`,
							pointer: `/registers/decisions`,
							received: `${s1.slice(0, 80)} vs ${s2.slice(0, 80)}`,
							recoveryHint:
								'Revise or supersede one of the conflicting decisions.',
							registerItemId: d1.id,
							ruleId: 'register_lifecycle_consistency',
							severity: 'error',
							sourcePath: input.workspacePath,
						},
						counter,
					),
				);
			}
		}
	}

	// Confirmed assumption contradicts confirmed decision for same document
	for (const assumption of registers.assumptions) {
		if (assumption.status !== 'confirmed') continue;
		const aText = (assumption.assumptionStatement ?? assumption.title)
			.toLowerCase()
			.trim();
		const aDocs = new Set(
			assumption.affectedDocumentLinks.map((l) => l.documentCanonicalId),
		);
		for (const decision of confirmedDecisions) {
			const dDocs = new Set(
				decision.affectedDocumentLinks.map((l) => l.documentCanonicalId),
			);
			const sharedDoc = [...aDocs].find((id) => dDocs.has(id));
			if (!sharedDoc) continue;
			const dText = (decision.decisionStatement ?? decision.title)
				.toLowerCase()
				.trim();

			const negationPatterns = [
				aText.replace(/\bnot\s+/g, '') === dText,
				dText.replace(/\bnot\s+/g, '') === aText,
				aText.includes('do not') &&
					dText.includes('do ') &&
					!dText.includes('do not'),
				dText.includes('do not') &&
					aText.includes('do ') &&
					!aText.includes('do not'),
			];

			if (negationPatterns.some(Boolean)) {
				violations.push(
					createViolation(
						{
							category: 'register_state',
							documentCanonicalId: sharedDoc,
							expected:
								'consistent assumption and decision for the same document',
							message: `Assumption "${assumption.title}" contradicts confirmed decision "${decision.title}" for document ${sharedDoc}.`,
							pointer: `/registers/assumptions/${assumption.id}`,
							received: `${aText.slice(0, 80)} vs ${dText.slice(0, 80)}`,
							recoveryHint:
								'Revise the assumption or decision to remove the contradiction.',
							registerItemId: assumption.id,
							ruleId: 'register_lifecycle_consistency',
							severity: 'error',
							sourcePath: input.workspacePath,
						},
						counter,
					),
				);
			}
		}
	}

	// Validated hypothesis contradicts missing-evidence finding
	for (const h of registers.hypotheses) {
		if (h.status === 'validated') {
			const hyp = h as HypothesisRegisterItem;
			if (!hyp.evidenceSourceIds || hyp.evidenceSourceIds.length === 0) {
				violations.push(
					createViolation(
						{
							category: 'validation_claim',
							expected: 'evidence sources present for validated hypothesis',
							message: `Validated hypothesis "${h.title}" contradicts the finding that evidence is missing.`,
							pointer: `/registers/hypotheses/${h.id}`,
							received: 'no evidence sources',
							recoveryHint:
								'Add evidence sources or change status to active/inconclusive.',
							registerItemId: h.id,
							ruleId: 'hypothesis_evidence_consistency',
							severity: 'error',
							sourcePath: input.workspacePath,
						},
						counter,
					),
				);
			}
		}
	}

	return violations;
}

function checkProvenanceConsistency(
	input: ConsistencyCheckInput,
	counter: { value: number },
): ConsistencyViolation[] {
	const violations: ConsistencyViolation[] = [];
	const claims = getProvenanceClaims(input);
	const sources = getProvenanceSources(input);
	const sourceIds = new Set(sources.map((s) => s.sourceId));

	for (const claim of claims) {
		if (claim.status === 'confirmed') {
			if (!claim.sourceLinks || claim.sourceLinks.length === 0) {
				violations.push(
					createViolation(
						{
							category: 'provenance',
							claimId: claim.claimId,
							expected: 'at least one source link',
							message: `Confirmed claim "${claim.summary}" has no source links.`,
							pointer: `/claims/${claim.claimId}`,
							received: 0,
							recoveryHint:
								'Add supporting source links or change status to requires_review.',
							ruleId: 'provenance_consistency',
							severity: 'warning',
							sourcePath: input.workspacePath,
						},
						counter,
					),
				);
			}
		}

		// Generated section claim without source
		if (
			claim.claimType === 'generated_section' &&
			claim.status === 'confirmed'
		) {
			if (!claim.sourceLinks || claim.sourceLinks.length === 0) {
				violations.push(
					createViolation(
						{
							category: 'provenance',
							claimId: claim.claimId,
							expected: 'source links for generated content',
							message: `Generated section claim "${claim.summary}" is confirmed without source links.`,
							pointer: `/claims/${claim.claimId}`,
							received: 0,
							recoveryHint:
								'Mark generated section claims as requires_review until sources are linked.',
							ruleId: 'provenance_consistency',
							severity: 'warning',
							sourcePath: input.workspacePath,
						},
						counter,
					),
				);
			}
		}

		// Claim-source links to unknown sources
		for (const link of claim.sourceLinks ?? []) {
			if (!sourceIds.has(link.sourceId)) {
				violations.push(
					createViolation(
						{
							category: 'provenance',
							claimId: claim.claimId,
							expected: 'known source record',
							message: `Claim "${claim.summary}" links to unknown source ${link.sourceId}.`,
							pointer: `/claims/${claim.claimId}/sourceLinks`,
							received: link.sourceId,
							recoveryHint:
								'Create the missing source record or remove the stale link.',
							ruleId: 'provenance_consistency',
							severity: 'error',
							sourceId: link.sourceId,
							sourcePath: input.workspacePath,
						},
						counter,
					),
				);
			}
		}
	}

	// External references not marked as fetched/verified
	for (const source of sources) {
		if (
			source.sourceType === 'external_reference' &&
			source.status === 'confirmed'
		) {
			const meta = source.metadata ?? {};
			const fetched = meta.fetchedAt || meta.verifiedAt;
			if (!fetched) {
				violations.push(
					createViolation(
						{
							category: 'provenance',
							expected: 'fetchedAt or verifiedAt metadata',
							message: `External reference source "${source.title}" is confirmed but not marked as fetched/verified.`,
							pointer: `/sources/${source.sourceId}`,
							received: 'none',
							recoveryHint:
								'Add fetch/verification metadata or change status to requires_review.',
							ruleId: 'provenance_consistency',
							severity: 'warning',
							sourceId: source.sourceId,
							sourcePath: input.workspacePath,
						},
						counter,
					),
				);
			}
		}
		if (
			source.sourceType === 'repository_scan' &&
			source.status === 'confirmed'
		) {
			const meta = source.metadata ?? {};
			const scanned = meta.scannedAt || meta.scanId;
			if (!scanned) {
				violations.push(
					createViolation(
						{
							category: 'provenance',
							expected: 'scannedAt or scanId metadata',
							message: `Repository scan source "${source.title}" is confirmed but has no scan metadata.`,
							pointer: `/sources/${source.sourceId}`,
							received: 'none',
							recoveryHint:
								'Add scan metadata or change status to requires_review.',
							ruleId: 'provenance_consistency',
							severity: 'warning',
							sourceId: source.sourceId,
							sourcePath: input.workspacePath,
						},
						counter,
					),
				);
			}
		}
	}

	return violations;
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

export function runConsistencyCheck(
	input: ConsistencyCheckInput,
	options: ConsistencyCheckOptions = {},
): ConsistencyCheckResult {
	const counter = { value: 0 };
	const allViolations: ConsistencyViolation[] = [];
	const diagnostics: ConsistencyCheckDiagnostic[] = [];

	const rulesInOrder = CONSISTENCY_RULE_ORDER.map((id) =>
		getConsistencyRuleById(id),
	).filter((r): r is NonNullable<typeof r> => r !== undefined);

	for (const rule of rulesInOrder) {
		try {
			let violations: ConsistencyViolation[] = [];
			switch (rule.id) {
				case 'root_path_consistency':
					violations = checkRootPathConsistency(input, counter);
					break;
				case 'profile_identity_consistency':
					violations = checkProfileIdentityConsistency(input, counter);
					break;
				case 'canonical_source_of_truth_boundary':
					violations = checkCanonicalSourceOfTruthBoundary(input, counter);
					break;
				case 'derived_artifact_boundary':
					violations = checkDerivedArtifactBoundary(input, counter);
					break;
				case 'validation_overclaim_boundary':
					violations = checkValidationOverclaimBoundary(input, counter);
					break;
				case 'hosted_saas_scope_boundary':
					violations = checkHostedSaaSScopeBoundary(input, counter);
					break;
				case 'external_sync_scope_boundary':
					violations = checkExternalSyncScopeBoundary(input, counter);
					break;
				case 'token_storage_boundary':
					violations = checkTokenStorageBoundary(input, counter);
					break;
				case 'ai_authority_boundary':
					violations = checkAiAuthorityBoundary(input, counter);
					break;
				case 'unresolved_question_visibility':
					violations = checkUnresolvedQuestionVisibility(input, counter);
					break;
				case 'register_lifecycle_consistency':
					violations = [
						...checkRegisterLifecycleConsistency(input, counter),
						...checkRegisterContradictions(input, counter),
					];
					break;
				case 'provenance_consistency':
					violations = checkProvenanceConsistency(input, counter);
					break;
				case 'risk_acceptance_consistency':
					violations = checkRiskAcceptanceConsistency(input, counter);
					break;
				case 'hypothesis_evidence_consistency':
					violations = checkHypothesisEvidenceConsistency(input, counter);
					break;
				case 'executive_axis_scope_boundary':
					violations = checkExecutiveAxisScopeBoundary(input, counter);
					break;
				case 'readme_profile_drift':
					if (options.readmeCheckEnabled !== false) {
						violations = checkReadmeProfileDrift(input, counter);
					}
					break;
				case 'generated_output_metadata_consistency':
					violations = checkGeneratedOutputMetadataConsistency(input, counter);
					break;
			}
			allViolations.push(...violations);
		} catch (err) {
			diagnostics.push({
				code: `consistency_rule_error_${rule.id}`,
				message:
					err instanceof Error
						? `Rule ${rule.id} threw: ${err.message}`
						: `Rule ${rule.id} threw an unknown error.`,
				ruleId: rule.id,
				severity: 'warning',
			});
		}
	}

	// Filter by severity if includeInfo is false
	let filteredViolations = allViolations;
	if (options.includeInfo === false) {
		filteredViolations = allViolations.filter((v) => v.severity !== 'info');
	}

	// Convert to ValidationFinding
	const findings = sortValidationFindings(
		filteredViolations.map((v) => violationToValidationFinding(v)),
	);

	// Build summary
	const summary = buildConsistencySummary(filteredViolations, input);

	return {
		changedPaths: [],
		diagnostics,
		exportReadiness: summary.exportReadiness,
		findings,
		gateStatus: summary.gateStatus,
		readOnly: true,
		summary,
		violations: filteredViolations,
	};
}

function buildConsistencySummary(
	violations: ConsistencyViolation[],
	input: ConsistencyCheckInput,
): ConsistencySummary {
	const byRuleId: Partial<Record<ConsistencyRuleId, number>> = {};
	const byCategory: Partial<Record<ConsistencyRuleCategory, number>> = {};
	const affectedDocs = new Set<string>();
	let releaseBlocking = 0;
	let warningCount = 0;
	let infoCount = 0;
	let contradictionCount = 0;
	let boundaryCount = 0;
	const blockers: ExportReadinessBlocker[] = [];

	for (const v of violations) {
		byRuleId[v.ruleId] = (byRuleId[v.ruleId] ?? 0) + 1;
		byCategory[v.category] = (byCategory[v.category] ?? 0) + 1;
		if (v.documentCanonicalId) affectedDocs.add(v.documentCanonicalId);
		if (v.severity === 'fatal' || v.severity === 'error') {
			releaseBlocking++;
			const rule = getConsistencyRuleById(v.ruleId);
			if (rule?.canBlockExport) {
				blockers.push({
					documentCanonicalId: v.documentCanonicalId,
					reason: v.message,
					ruleId: v.ruleId,
					severity: v.severity,
				});
			}
		}
		if (v.severity === 'warning') warningCount++;
		if (v.severity === 'info') infoCount++;

		if (
			v.ruleId === 'register_lifecycle_consistency' ||
			v.ruleId === 'validation_overclaim_boundary' ||
			v.ruleId === 'generated_output_metadata_consistency'
		) {
			contradictionCount++;
		} else {
			boundaryCount++;
		}
	}

	const registers = getRegisterItems(input);
	const unresolvedBlockingQuestionCount = registers
		? registers.openQuestions.filter((q) => q.status === 'open' && q.isBlocking)
				.length
		: 0;

	const hasFatal = violations.some((v) => v.severity === 'fatal');
	const hasError = violations.some((v) => v.severity === 'error');
	const hasWarning = violations.some((v) => v.severity === 'warning');
	const hasInfo = violations.some((v) => v.severity === 'info');

	let gateStatus: ConsistencyGateStatus = 'pass';
	if (hasFatal || hasError) {
		gateStatus = 'fail';
	} else if (hasWarning) {
		gateStatus = 'pass_with_warnings';
	} else if (hasInfo) {
		gateStatus = 'pass';
	}

	let exportReadiness: ExportReadinessStatus = 'ready';
	if (hasFatal || hasError) {
		exportReadiness = 'blocked';
	} else if (hasWarning) {
		exportReadiness = 'ready_with_warnings';
	}

	return {
		affectedDocumentIds: [...affectedDocs].sort(),
		blockers,
		boundaryViolationCount: boundaryCount,
		byCategory,
		byRuleId,
		contradictionCount,
		exportReadiness,
		gateStatus,
		infoCount,
		releaseBlockingCount: releaseBlocking,
		totalViolations: violations.length,
		unresolvedBlockingQuestionCount,
		warningCount,
	};
}
