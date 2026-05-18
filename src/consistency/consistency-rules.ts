/** Step 8.3 — Deterministic consistency rule registry */

import type {
	ConsistencyRule,
	ConsistencyRuleId,
} from './consistency-types.js';

export const CONSISTENCY_RULE_REGISTRY: Record<
	ConsistencyRuleId,
	ConsistencyRule
> = {
	ai_authority_boundary: {
		canBlockExport: true,
		canBlockGeneration: false,
		category: 'security_boundary',
		checks:
			'AI output remains proposed/reviewable until explicitly accepted; proposed AI extraction does not become confirmed decision/register item without explicit lifecycle event; AI diagnostic interpretation does not alter deterministic validation findings; inferred claims are not confirmed without review.',
		defaultSeverity: 'error',
		doesNotCheck:
			'AI model quality, provider response accuracy, semantic similarity of AI suggestions.',
		id: 'ai_authority_boundary',
		order: 9,
		sourceReferences: [
			'docs/01-foundation/04-principles.md',
			'docs/04-engineering/13-engineering-standards.md',
		],
		title: 'AI Authority Boundary',
	},
	canonical_source_of_truth_boundary: {
		canBlockExport: true,
		canBlockGeneration: false,
		category: 'source_of_truth',
		checks:
			'Canonical Markdown and structured local state are authoritative; HTML, agent packs, and executive exports are not marked canonical; artifact metadata is not used as proof of document completeness.',
		defaultSeverity: 'error',
		doesNotCheck:
			'Content correctness of canonical Markdown, semantic completeness of documents, external file validation.',
		id: 'canonical_source_of_truth_boundary',
		order: 3,
		sourceReferences: [
			'docs/01-foundation/04-principles.md',
			'docs/04-engineering/05-data-model.md',
		],
		title: 'Canonical Source-of-Truth Boundary',
	},
	derived_artifact_boundary: {
		canBlockExport: true,
		canBlockGeneration: false,
		category: 'artifact_boundary',
		checks:
			'Derived artifacts (HTML, agent pack, executive exports) are marked non-canonical; derived artifacts are not used as sources for canonical Markdown; generated output metadata marks derived artifacts as non-canonical.',
		defaultSeverity: 'error',
		doesNotCheck:
			'Whether derived artifact files are valid or up-to-date, semantic quality of derived outputs.',
		id: 'derived_artifact_boundary',
		order: 4,
		sourceReferences: ['docs/04-engineering/05-data-model.md'],
		title: 'Derived Artifact Boundary',
	},
	executive_axis_scope_boundary: {
		canBlockExport: true,
		canBlockGeneration: false,
		category: 'executive_scope',
		checks:
			'Executive Axis is generated from normative documentation baseline; output is portable JSON plus derived exports; does not become live task manager state; Linear/Notion mappings are planned adapter contracts; no bidirectional sync/live external integration claims; readiness blocked if normative baseline has release-blocking contradictions.',
		defaultSeverity: 'error',
		doesNotCheck:
			'Executive Axis compilation, HTML generation, traceability rendering, actual export file creation.',
		id: 'executive_axis_scope_boundary',
		order: 14,
		sourceReferences: [
			'docs/roadmap/IMPLEMENTATION_ROADMAP.md',
			'docs/03-product/02-scope.md',
		],
		title: 'Executive Axis Scope Boundary',
	},
	external_sync_scope_boundary: {
		canBlockExport: true,
		canBlockGeneration: false,
		category: 'scope_boundary',
		checks:
			'Live external sync, bidirectional sync, automatic external research, and real-time collaboration are not claimed as implemented MVP behavior; register decisions/requirements do not mark these as MVP/current.',
		defaultSeverity: 'error',
		doesNotCheck:
			'Adapter contract design for future sync, API schema correctness, external service availability.',
		id: 'external_sync_scope_boundary',
		order: 7,
		sourceReferences: [
			'docs/03-product/02-scope.md',
			'docs/04-engineering/09-sync-and-state.md',
		],
		title: 'External Sync Scope Boundary',
	},
	generated_output_metadata_consistency: {
		canBlockExport: true,
		canBlockGeneration: false,
		category: 'generation_readiness',
		checks:
			'Generated document metadata document id matches descriptor/document; phase id matches profile contract; canonical output path matches active root; generated status does not claim validation passed without evidence; derived artifact metadata marks artifact as non-canonical; references are consistent; stale/orphaned outputs are not treated as current/ready.',
		defaultSeverity: 'error',
		doesNotCheck:
			'Content quality of generated Markdown, semantic correctness of rendered sections, external link validity.',
		id: 'generated_output_metadata_consistency',
		order: 16,
		sourceReferences: [
			'src/generation/safe-markdown-writer.ts',
			'src/state/workspace-state.schema.ts',
		],
		title: 'Generated Output Metadata Consistency',
	},
	hosted_saas_scope_boundary: {
		canBlockExport: true,
		canBlockGeneration: false,
		category: 'scope_boundary',
		checks:
			'Hosted backend, managed database, user accounts, cloud workspace, live collaboration, profile marketplace, automatic external research, live external sync, notifications, calendar workflows, ownership assignment, and bidirectional external sync are not claimed as MVP/current unless explicitly documented as later/deferred.',
		defaultSeverity: 'error',
		doesNotCheck:
			'Whether future/deferred mentions are realistic, business model viability, technical feasibility of later features.',
		id: 'hosted_saas_scope_boundary',
		order: 6,
		sourceReferences: [
			'docs/03-product/02-scope.md',
			'docs/04-engineering/14-technical-risks.md',
		],
		title: 'Hosted/SaaS Scope Boundary',
	},
	hypothesis_evidence_consistency: {
		canBlockExport: true,
		canBlockGeneration: false,
		category: 'validation_claim',
		checks:
			'Hypotheses marked validated have explicit evidence/source links; hypotheses marked invalidated have reasoning; active hypotheses have expected signal defined; inconclusive hypotheses are documented.',
		defaultSeverity: 'error',
		doesNotCheck:
			'Statistical significance, experimental design quality, external data validity.',
		id: 'hypothesis_evidence_consistency',
		order: 13,
		sourceReferences: [
			'docs/02-validation/03-hypotheses.md',
			'src/registers/register-types.ts',
		],
		title: 'Hypothesis Evidence Consistency',
	},
	profile_identity_consistency: {
		canBlockExport: true,
		canBlockGeneration: false,
		category: 'profile_identity',
		checks:
			'Active profile matches workspace lock; generated metadata profileId matches active profile; artifact registry profile metadata matches active profile; no stale profile name references in loaded metadata.',
		defaultSeverity: 'error',
		doesNotCheck:
			'Profile content validity, profile schema correctness, remote profile fetching.',
		id: 'profile_identity_consistency',
		order: 2,
		sourceReferences: [
			'profiles/standard/docs.yml',
			'workspace-state.schema.ts',
		],
		title: 'Profile Identity Consistency',
	},
	provenance_consistency: {
		canBlockExport: true,
		canBlockGeneration: false,
		category: 'provenance',
		checks:
			'Confirmed claims have supporting source links; generated section claims have sources; claim-source links resolve to known sources; external references are marked fetched/verified; repository scans have scan metadata; inferred content is review-required.',
		defaultSeverity: 'warning',
		doesNotCheck:
			'Semantic quality of sources, external link validity, truthfulness of claims.',
		id: 'provenance_consistency',
		order: 17,
		sourceReferences: [
			'src/provenance/provenance-types.ts',
			'src/provenance/provenance-schema.ts',
		],
		title: 'Provenance Consistency',
	},
	readme_profile_drift: {
		canBlockExport: false,
		canBlockGeneration: false,
		category: 'profile_identity',
		checks:
			'README or docs metadata references match active profile; stale profile names such as app-business produce findings when references are part of loaded repository metadata/fixtures.',
		defaultSeverity: 'warning',
		doesNotCheck:
			'Content quality of README, external documentation links, marketing copy accuracy.',
		id: 'readme_profile_drift',
		order: 15,
		sourceReferences: ['README.md', 'profiles/standard/docs.yml'],
		title: 'README Profile Drift',
	},
	register_lifecycle_consistency: {
		canBlockExport: true,
		canBlockGeneration: false,
		category: 'register_state',
		checks:
			'Invalid lifecycle transitions produce findings; rejected/superseded items are not used as active sources; confirmed decisions have required sources; assumptions marked confirmed have explicit confidence; accepted risks have mitigation/review notes; validated hypotheses have evidence; resolved questions have resolution summary/source; contradictory statuses in lifecycle history produce findings.',
		defaultSeverity: 'error',
		doesNotCheck:
			'Whether lifecycle transitions are semantically correct, business logic of decisions, external approval workflows.',
		id: 'register_lifecycle_consistency',
		order: 11,
		sourceReferences: [
			'src/registers/register-lifecycle.ts',
			'src/registers/register-types.ts',
		],
		title: 'Register Lifecycle Consistency',
	},
	risk_acceptance_consistency: {
		canBlockExport: true,
		canBlockGeneration: false,
		category: 'register_state',
		checks:
			'Accepted risks have mitigation or review notes; resolved risks do not have active mitigation/open questions indicating unresolved state; risk status transitions are valid.',
		defaultSeverity: 'warning',
		doesNotCheck:
			'Risk quantification accuracy, external risk assessment, business impact analysis.',
		id: 'risk_acceptance_consistency',
		order: 12,
		sourceReferences: [
			'docs/02-validation/10-validation-report.md',
			'src/registers/register-types.ts',
		],
		title: 'Risk Acceptance Consistency',
	},
	root_path_consistency: {
		canBlockExport: true,
		canBlockGeneration: true,
		category: 'root_path',
		checks:
			'Documentation root is logos/ by default; configured root matches generation output paths; artifact registry paths stay under configured root; generated metadata paths match descriptor/current root; no path traversal or unsafe absolute paths.',
		defaultSeverity: 'error',
		doesNotCheck:
			'Whether files actually exist on disk, whether custom non-logos roots are semantically correct, cross-repository root comparisons.',
		id: 'root_path_consistency',
		order: 1,
		sourceReferences: [
			'docs/01-foundation/04-principles.md',
			'workspace-state.schema.ts',
		],
		title: 'Root Path Consistency',
	},
	token_storage_boundary: {
		canBlockExport: true,
		canBlockGeneration: true,
		category: 'security_boundary',
		checks:
			'Workspace state, source/claim/register metadata, artifact metadata, generated output metadata, and validation reports do not store raw provider tokens; only environment variable names are allowed in provider config.',
		defaultSeverity: 'error',
		doesNotCheck:
			'External secret managers, encrypted-at-rest guarantees, network transport security.',
		id: 'token_storage_boundary',
		order: 8,
		sourceReferences: [
			'docs/04-engineering/08-security-and-privacy.md',
			'SECURITY.md',
		],
		title: 'Token Storage Boundary',
	},
	unresolved_question_visibility: {
		canBlockExport: true,
		canBlockGeneration: false,
		category: 'register_state',
		checks:
			'Open/blocking questions affecting a document remain visible in status/validation/generation summaries; documents do not claim complete/ready when blocking open questions remain; generation reports include unresolved/blocking question counts; resolved questions have resolution source/decision.',
		defaultSeverity: 'warning',
		doesNotCheck:
			'Whether questions are actually important, semantic classification of questions, auto-resolution of questions.',
		id: 'unresolved_question_visibility',
		order: 10,
		sourceReferences: [
			'docs/02-validation/08-evidence-log.md',
			'docs/02-validation/09-decision-record.md',
		],
		title: 'Unresolved Question Visibility',
	},
	validation_overclaim_boundary: {
		canBlockExport: true,
		canBlockGeneration: false,
		category: 'validation_claim',
		checks:
			'Claims of market demand, pricing, retention, willingness to pay, legal compliance, security audit, or production readiness have explicit evidence/source records; generated docs do not claim validation passed unless deterministic validation ran; hypotheses marked validated have evidence/source links.',
		defaultSeverity: 'warning',
		doesNotCheck:
			'Truthfulness of claims via external research, domain-specific legal/security validation, AI-based semantic judgment of evidence quality.',
		id: 'validation_overclaim_boundary',
		order: 5,
		sourceReferences: [
			'docs/02-validation/02-core-assumptions.md',
			'docs/02-validation/03-hypotheses.md',
		],
		title: 'Validation Overclaim Boundary',
	},
};

export const CONSISTENCY_RULE_ORDER: ConsistencyRuleId[] = [
	'root_path_consistency',
	'profile_identity_consistency',
	'canonical_source_of_truth_boundary',
	'derived_artifact_boundary',
	'validation_overclaim_boundary',
	'hosted_saas_scope_boundary',
	'external_sync_scope_boundary',
	'token_storage_boundary',
	'ai_authority_boundary',
	'unresolved_question_visibility',
	'register_lifecycle_consistency',
	'risk_acceptance_consistency',
	'hypothesis_evidence_consistency',
	'executive_axis_scope_boundary',
	'readme_profile_drift',
	'generated_output_metadata_consistency',
	'provenance_consistency',
];

export function getAllConsistencyRules(): ConsistencyRule[] {
	return CONSISTENCY_RULE_ORDER.map((id) => CONSISTENCY_RULE_REGISTRY[id]);
}

export function getConsistencyRuleById(
	id: ConsistencyRuleId,
): ConsistencyRule | undefined {
	return CONSISTENCY_RULE_REGISTRY[id];
}
