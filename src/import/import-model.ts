/** Step 12.1 — Import Plan Model: types, contracts, and statuses */

import { createHash } from 'node:crypto';
import type { DocumentationContract } from '../profiles/documentation-contract.js';

// ---------------------------------------------------------------------------
// Shared helpers (used by discovery, classification, and planner)
// ---------------------------------------------------------------------------

export function computeCandidateId(number: number): string {
	return `import-candidate-${number}`;
}

export function computeStringChecksum(content: string): string {
	return createHash('sha256').update(content, 'utf-8').digest('hex');
}

// ---------------------------------------------------------------------------
// Candidate Kinds
// ---------------------------------------------------------------------------

export type DocumentationImportCandidateKind =
	| 'markdown_document'
	| 'profile_registry'
	| 'phase_descriptor'
	| 'document_descriptor'
	| 'executive_descriptor'
	| 'raw_note'
	| 'transcript'
	| 'unknown'
	| 'unsupported';

export const IMPORT_CANDIDATE_KIND_ORDER: Record<
	DocumentationImportCandidateKind,
	number
> = {
	document_descriptor: 0,
	executive_descriptor: 1,
	markdown_document: 2,
	phase_descriptor: 3,
	profile_registry: 4,
	raw_note: 5,
	transcript: 6,
	unknown: 7,
	unsupported: 8,
};

// ---------------------------------------------------------------------------
// Candidate Statuses
// ---------------------------------------------------------------------------

export type DocumentationImportCandidateStatus =
	| 'mapped'
	| 'ambiguous'
	| 'unmapped'
	| 'duplicate'
	| 'conflicting'
	| 'blocked'
	| 'unsupported'
	| 'unsafe'
	| 'unknown';

export const IMPORT_CANDIDATE_STATUS_ORDER: Record<
	DocumentationImportCandidateStatus,
	number
> = {
	ambiguous: 1,
	blocked: 5,
	conflicting: 2,
	duplicate: 3,
	mapped: 0,
	unknown: 8,
	unmapped: 4,
	unsafe: 7,
	unsupported: 6,
};

// ---------------------------------------------------------------------------
// Mapping Statuses
// ---------------------------------------------------------------------------

export type DocumentationImportMappingStatus =
	| 'proposed'
	| 'high_confidence'
	| 'medium_confidence'
	| 'low_confidence'
	| 'ambiguous'
	| 'blocked'
	| 'not_applicable';

export const IMPORT_MAPPING_STATUS_ORDER: Record<
	DocumentationImportMappingStatus,
	number
> = {
	ambiguous: 4,
	blocked: 5,
	high_confidence: 0,
	low_confidence: 3,
	medium_confidence: 2,
	not_applicable: 6,
	proposed: 1,
};

// ---------------------------------------------------------------------------
// Action Kinds
// ---------------------------------------------------------------------------

export type DocumentationImportActionKind =
	| 'propose_import_as_canonical_source'
	| 'propose_import_as_reference'
	| 'propose_map_to_document'
	| 'propose_create_open_question'
	| 'propose_create_assumption'
	| 'propose_create_decision'
	| 'skip_existing_current'
	| 'manual_review_required'
	| 'unsupported_deferred'
	| 'blocked_no_action';

export const IMPORT_ACTION_KIND_ORDER: Record<
	DocumentationImportActionKind,
	number
> = {
	blocked_no_action: 9,
	manual_review_required: 7,
	propose_create_assumption: 4,
	propose_create_decision: 3,
	propose_create_open_question: 5,
	propose_import_as_canonical_source: 0,
	propose_import_as_reference: 2,
	propose_map_to_document: 1,
	skip_existing_current: 6,
	unsupported_deferred: 8,
};

// ---------------------------------------------------------------------------
// Conflict Kinds
// ---------------------------------------------------------------------------

export type DocumentationImportConflictKind =
	| 'existing_canonical_output'
	| 'multiple_candidates_same_document'
	| 'candidate_maps_to_multiple_documents'
	| 'unsafe_path'
	| 'unsupported_format'
	| 'profile_mismatch'
	| 'schema_mismatch'
	| 'derived_artifact_as_source'
	| 'secret_or_sensitive_content'
	| 'manual_edit_collision'
	| 'unknown_conflict';

export const IMPORT_CONFLICT_KIND_ORDER: Record<
	DocumentationImportConflictKind,
	number
> = {
	candidate_maps_to_multiple_documents: 2,
	derived_artifact_as_source: 3,
	existing_canonical_output: 0,
	manual_edit_collision: 9,
	multiple_candidates_same_document: 1,
	profile_mismatch: 7,
	schema_mismatch: 8,
	secret_or_sensitive_content: 5,
	unknown_conflict: 10,
	unsafe_path: 4,
	unsupported_format: 6,
};

// ---------------------------------------------------------------------------
// Readiness
// ---------------------------------------------------------------------------

export type DocumentationImportReadiness =
	| 'ready_for_review'
	| 'blocked'
	| 'requires_manual_review'
	| 'empty'
	| 'unknown';

export const IMPORT_READINESS_ORDER: Record<
	DocumentationImportReadiness,
	number
> = {
	blocked: 0,
	empty: 1,
	ready_for_review: 3,
	requires_manual_review: 2,
	unknown: 4,
};

// ---------------------------------------------------------------------------
// Candidate Source
// ---------------------------------------------------------------------------

export type DocumentationImportCandidateSource =
	| 'explicit_path'
	| 'documentation_root'
	| 'fixture';

// ---------------------------------------------------------------------------
// Scope & Path Policy
// ---------------------------------------------------------------------------

export type DocumentationImportScope =
	| 'candidate_discovery'
	| 'mapping'
	| 'conflict_detection'
	| 'full_plan';

export interface DocumentationImportPathPolicy {
	allowAbsolutePaths: boolean;
	allowedExtensions: string[];
	maxFileSizeBytes: number;
	disallowPathTraversal: boolean;
}

// ---------------------------------------------------------------------------
// Candidate
// ---------------------------------------------------------------------------

export interface DocumentationImportMetadata {
	title?: string | undefined;
	headings?: string[] | undefined;
	frontmatterKeys?: string[] | undefined;
	declaredId?: string | undefined;
	declaredDocumentId?: string | undefined;
	declaredPhaseId?: string | undefined;
	declaredProfileId?: string | undefined;
	topLevelKeys?: string[] | undefined;
	outputDeclarations?: string[] | undefined;
	schemaFields?: string[] | undefined;
	kind?: DocumentationImportCandidateKind | undefined;
	sizeBytes: number;
	checksum?: string | undefined;
	modifiedTimestamp?: string | undefined;
	sourceMarkers?: string[] | undefined;
}

export interface DocumentationImportCandidate {
	id: string;
	relativePath: string;
	absolutePath?: string | undefined;
	kind: DocumentationImportCandidateKind;
	status: DocumentationImportCandidateStatus;
	source: DocumentationImportCandidateSource;
	/** Snippet of start of file content for diagnostic use, redacted */
	contentSnippet?: string | undefined;
	metadata: DocumentationImportMetadata;
	root: string;
	extension: string;
	sizeBytes: number;
	blockers: DocumentationImportBlocker[];
	warnings: DocumentationImportWarning[];
}

// ---------------------------------------------------------------------------
// Blocker
// ---------------------------------------------------------------------------

export interface DocumentationImportBlocker {
	code: string;
	message: string;
	sourcePath?: string | undefined;
	candidateId?: string | undefined;
	recoveryHint?: string | undefined;
	severity: 'error' | 'fatal';
}

// ---------------------------------------------------------------------------
// Warning
// ---------------------------------------------------------------------------

export interface DocumentationImportWarning {
	code: string;
	message: string;
	sourcePath?: string | undefined;
	candidateId?: string | undefined;
	recoveryHint?: string | undefined;
}

// ---------------------------------------------------------------------------
// Diagnostic
// ---------------------------------------------------------------------------

export interface DocumentationImportDiagnostic {
	code: string;
	severity: 'info' | 'warning' | 'error' | 'fatal';
	message: string;
	sourcePath?: string | undefined;
	pointer?: string | undefined;
	candidateId?: string | undefined;
	candidateKind?: DocumentationImportCandidateKind | undefined;
	targetDocumentId?: string | undefined;
	targetPhaseId?: string | undefined;
	conflictId?: string | undefined;
	expected?: unknown;
	received?: unknown;
	recoveryHint?: string | undefined;
}

// ---------------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------------

export interface DocumentationImportMappingEvidence {
	signal: string;
	reason: string;
	score?: number | undefined;
}

export interface DocumentationImportMapping {
	id: string;
	candidateId: string;
	targetDocumentCanonicalId?: string | undefined;
	targetDocumentId?: string | undefined;
	targetPhaseId?: string | undefined;
	status: DocumentationImportMappingStatus;
	confidence: number;
	/** 0.0 to 1.0 */
	score: number;
	evidence: DocumentationImportMappingEvidence[];
	blockers: DocumentationImportBlocker[];
	warnings: DocumentationImportWarning[];
	requiresManualReview: boolean;
}

// ---------------------------------------------------------------------------
// Conflict
// ---------------------------------------------------------------------------

export interface DocumentationImportConflict {
	id: string;
	kind: DocumentationImportConflictKind;
	message: string;
	severity: 'warning' | 'error' | 'fatal';
	candidateIds: string[];
	targetDocumentId?: string | undefined;
	targetPhaseId?: string | undefined;
	sourcePath?: string | undefined;
	pointer?: string | undefined;
	recoveryHint?: string | undefined;
}

// ---------------------------------------------------------------------------
// Proposed Action
// ---------------------------------------------------------------------------

export interface DocumentationImportProposedAction {
	id: string;
	kind: DocumentationImportActionKind;
	candidateId: string;
	candidatePath: string;
	targetDocumentId?: string | undefined;
	targetPhaseId?: string | undefined;
	mappingId?: string | undefined;
	confidence: number;
	evidence: DocumentationImportMappingEvidence[];
	blockers: DocumentationImportBlocker[];
	warnings: DocumentationImportWarning[];
	requiresUserReview: boolean;
	expectedFutureMutation: string;
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

export interface DocumentationImportSummary {
	totalCandidates: number;
	mappedCandidates: number;
	ambiguousCandidates: number;
	unmappedCandidates: number;
	duplicateCandidates: number;
	blockedCandidates: number;
	unsupportedCandidates: number;
	unsafeCandidates: number;
	totalConflicts: number;
	totalBlockers: number;
	totalWarnings: number;
	totalDiagnostics: number;
	totalProposedActions: number;
}

// ---------------------------------------------------------------------------
// Plan
// ---------------------------------------------------------------------------

export interface DocumentationImportPlan {
	profileId: string;
	profileVersion?: string | undefined;
	documentationRoot: string;
	candidateRoots: string[];
	evaluatedAt: string;
	dryRun: boolean;
	readOnly: true;
	candidates: DocumentationImportCandidate[];
	mappings: DocumentationImportMapping[];
	conflicts: DocumentationImportConflict[];
	blockers: DocumentationImportBlocker[];
	warnings: DocumentationImportWarning[];
	diagnostics: DocumentationImportDiagnostic[];
	proposedActions: DocumentationImportProposedAction[];
	summary: DocumentationImportSummary;
	readiness: DocumentationImportReadiness;
}

// ---------------------------------------------------------------------------
// Plan Result
// ---------------------------------------------------------------------------

export interface DocumentationImportPlanResult {
	plan: DocumentationImportPlan;
	changedPaths: [];
}

// ---------------------------------------------------------------------------
// Input & Options
// ---------------------------------------------------------------------------

export interface DocumentationImportPlanInput {
	/** Explicit candidate paths provided by caller */
	candidatePaths?: string[] | undefined;
	/** Safe configured documentation roots */
	documentationRoots?: string[] | undefined;
	/** In-memory candidate fixtures for tests (path -> content) */
	fixtures?: Map<string, string> | undefined;
	/** Active documentation contract for mapping */
	documentationContract?: DocumentationContract | undefined;
	/** Active profile ID */
	profileId: string;
	/** Profile version if available */
	profileVersion?: string | undefined;
	/** Documentation root */
	documentationRoot: string;
	/** Project root for path containment */
	projectRoot?: string | undefined;
	/** Known existing artifact registry paths for conflict detection */
	existingCanonicalOutputs?: string[] | undefined;
	/** Manual edit statuses for existing outputs (path -> hasManualEdits) */
	manualEditStatuses?: Map<string, boolean> | undefined;
	/** Injected clock timestamp (ISO 8601) */
	evaluatedAt?: string | undefined;
}

export interface DocumentationImportPlanOptions {
	dryRun?: boolean | undefined;
	pathPolicy?: Partial<DocumentationImportPathPolicy> | undefined;
	scope?: DocumentationImportScope | undefined;
	candidateIdsForTests?: boolean | undefined;
}

// ---------------------------------------------------------------------------
// Planner Type
// ---------------------------------------------------------------------------

export type DocumentationImportPlanner = (
	input: DocumentationImportPlanInput,
	options?: DocumentationImportPlanOptions,
) => DocumentationImportPlanResult;

/** A dry-run import report is synonymous with the import plan itself */
export type DocumentationImportDryRunReport = DocumentationImportPlan;

// ---------------------------------------------------------------------------
// Default path policy
// ---------------------------------------------------------------------------

export const DEFAULT_IMPORT_PATH_POLICY: DocumentationImportPathPolicy = {
	allowAbsolutePaths: false,
	allowedExtensions: ['.md', '.markdown', '.yml', '.yaml', '.json'],
	disallowPathTraversal: true,
	maxFileSizeBytes: 1024 * 1024, // 1 MB
};

// ---------------------------------------------------------------------------
// Derived artifact path patterns
// ---------------------------------------------------------------------------

export const DERIVED_ARTIFACT_PATH_MARKERS = [
	/html/i,
	/agent.?pack/i,
	/executive.?export/i,
	/executive.?plan/i,
	/validation.?report/i,
	/diagnostic.?report/i,
	/diagnose.?report/i,
	/review.?report/i,
	/staleness.?report/i,
	/regeneration.?report/i,
];

export const DERIVED_ARTIFACT_CONTENT_MARKERS = [
	/This is a derived artifact/i,
	/This file is generated/i,
	/generated at:/i,
	/derived.*artifact/i,
	/do not edit manually/i,
	/auto-generated/i,
	/validation report/i,
	/diagnostic report/i,
	/executive plan/i,
	/agent pack/i,
];

// ---------------------------------------------------------------------------
// Transcript content markers
// ---------------------------------------------------------------------------

export const TRANSCRIPT_CONTENT_MARKERS = [
	/\btranscript\b/i,
	/\bconversation\s+log\b/i,
	/\bchat\s+log\b/i,
	/\bsession\s+log\b/i,
	/---\s*\n\s*\[?\d{2}:\d{2}/,
	/^\d{2}:\d{2}(:\d{2})?\s+[-–—]/m,
	/^(User|Human|Agent|Assistant|System):\s/m,
	/<message\b/i,
];

// ---------------------------------------------------------------------------
// Derivation detection helpers
// ---------------------------------------------------------------------------

export function pathLooksLikeDerivedArtifact(path: string): boolean {
	return DERIVED_ARTIFACT_PATH_MARKERS.some((p) => p.test(path));
}

export function contentLooksLikeDerivedArtifact(content: string): boolean {
	return DERIVED_ARTIFACT_CONTENT_MARKERS.some((p) => p.test(content));
}

export function contentLooksLikeTranscript(content: string): boolean {
	return TRANSCRIPT_CONTENT_MARKERS.some((p) => p.test(content));
}
