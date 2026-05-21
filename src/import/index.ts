/** Steps 12.1 & 12.4 — Import module barrel exports */

// ---------------------------------------------------------------------------
// Model types (Step 12.1)
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

// ---------------------------------------------------------------------------
// Step 12.4 — Candidate Fact/Decision Extraction Model
// ---------------------------------------------------------------------------

export type {
	CandidateExtractedAcceptanceCriterion,
	CandidateExtractedAssumption,
	CandidateExtractedConstraint,
	CandidateExtractedDecision,
	CandidateExtractedEvidenceReference,
	CandidateExtractedFact,
	CandidateExtractedHypothesis,
	CandidateExtractedItem,
	CandidateExtractedItemBase,
	CandidateExtractedItemConfidence,
	CandidateExtractedItemKind,
	CandidateExtractedItemStatus,
	CandidateExtractedNonGoal,
	CandidateExtractedOpenQuestion,
	CandidateExtractedRequirement,
	CandidateExtractedRisk,
	CandidateExtractionActionKind,
	CandidateExtractionBlocker,
	CandidateExtractionChangedPath,
	CandidateExtractionConflict,
	CandidateExtractionConflictKind,
	CandidateExtractionDiagnostic,
	CandidateExtractionEvidence,
	CandidateExtractionInput,
	CandidateExtractionOptions,
	CandidateExtractionReadiness,
	CandidateExtractionResult,
	CandidateExtractionReviewAction,
	CandidateExtractionSource,
	CandidateExtractionSourceKind,
	CandidateExtractionSummary,
	CandidateExtractionWarning,
	CandidateFactDecisionExtractor,
} from './candidate-extraction-model.js';

export {
	CANDIDATE_EXTRACTED_ITEM_CONFIDENCE_ORDER,
	CANDIDATE_EXTRACTED_ITEM_KIND_ORDER,
	CANDIDATE_EXTRACTED_ITEM_STATUS_ORDER,
	CANDIDATE_EXTRACTION_ACTION_KIND_ORDER,
	CANDIDATE_EXTRACTION_CONFLICT_KIND_ORDER,
	CANDIDATE_EXTRACTION_READINESS_ORDER,
	CANDIDATE_EXTRACTION_SOURCE_KIND_ORDER,
	contentLooksLikeDerivedArtifactExtraction,
	contentLooksLikeTranscriptExtraction,
	getExtractionIdCounter,
	nextExtractionId,
	pathLooksLikeDerivedArtifactExtraction,
	RECOGNIZED_FRONTMATTER_KEYS,
	RECOGNIZED_HEADINGS,
	resetExtractionIdCounter,
} from './candidate-extraction-model.js';

// ---------------------------------------------------------------------------
// Step 12.4 — Candidate Fact/Decision Extractor
// ---------------------------------------------------------------------------

export { extractCandidateFactsAndDecisions } from './candidate-fact-extractor.js';
