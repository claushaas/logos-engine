/** Step 12.1 — Import module barrel exports */

// ---------------------------------------------------------------------------
// Model types
// ---------------------------------------------------------------------------

export type {
	DocumentationImportActionKind,
	DocumentationImportBlocker,
	DocumentationImportCandidate,
	DocumentationImportCandidateKind,
	DocumentationImportCandidateSource,
	DocumentationImportCandidateStatus,
	DocumentationImportConflict,
	DocumentationImportConflictKind,
	DocumentationImportDiagnostic,
	DocumentationImportDryRunReport,
	DocumentationImportMapping,
	DocumentationImportMappingEvidence,
	DocumentationImportMappingStatus,
	DocumentationImportMetadata,
	DocumentationImportPathPolicy,
	DocumentationImportPlan,
	DocumentationImportPlanInput,
	DocumentationImportPlanner,
	DocumentationImportPlanOptions,
	DocumentationImportPlanResult,
	DocumentationImportProposedAction,
	DocumentationImportReadiness,
	DocumentationImportScope,
	DocumentationImportSummary,
	DocumentationImportWarning,
} from './import-model.js';

export {
	computeCandidateId,
	computeStringChecksum,
	contentLooksLikeDerivedArtifact,
	contentLooksLikeTranscript,
	DEFAULT_IMPORT_PATH_POLICY,
	IMPORT_ACTION_KIND_ORDER,
	IMPORT_CANDIDATE_KIND_ORDER,
	IMPORT_CANDIDATE_STATUS_ORDER,
	IMPORT_CONFLICT_KIND_ORDER,
	IMPORT_MAPPING_STATUS_ORDER,
	IMPORT_READINESS_ORDER,
	pathLooksLikeDerivedArtifact,
} from './import-model.js';

// ---------------------------------------------------------------------------
// Planner
// ---------------------------------------------------------------------------

export { planDocumentationImport } from './import-planner.js';

// ---------------------------------------------------------------------------
// Candidate discovery
// ---------------------------------------------------------------------------

export { discoverImportCandidates } from './import-candidate-discovery.js';

// ---------------------------------------------------------------------------
// Candidate classification
// ---------------------------------------------------------------------------

export {
	classifyImportCandidates,
	extractCandidateMetadata,
} from './import-candidate-classification.js';

// ---------------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------------

export { mapImportCandidates } from './import-mapping.js';

// ---------------------------------------------------------------------------
// Conflict detection
// ---------------------------------------------------------------------------

export {
	detectImportConflicts,
	resetConflictIdCounter,
} from './import-conflict-detection.js';

// ---------------------------------------------------------------------------
// Path safety
// ---------------------------------------------------------------------------

export {
	checkImportPathSafety,
	getPathExtension,
	isExtensionAllowed,
	isPathTraversal,
	normalizeImportPath,
	resolveImportPathPolicy,
	toRelativeImportPath,
} from './import-path-safety.js';

// ---------------------------------------------------------------------------
// Secret redaction
// ---------------------------------------------------------------------------

export {
	hasSecretLikeContent,
	redactImportContent,
	safeContentSnippet,
	scanForSecrets,
} from './import-redaction.js';
