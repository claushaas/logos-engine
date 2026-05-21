/** Generation module exports */

export {
	createGenerationPlan,
	planDocumentGeneration,
	summarizeGenerationPlan,
} from './generation-planner.js';

export type {
	DependencySatisfaction,
	GenerationAction,
	GenerationBlocker,
	GenerationDependencyState,
	GenerationDryRunSummary,
	GenerationGap,
	GenerationOutputTarget,
	GenerationPlan,
	GenerationPlanDiagnostic,
	GenerationPlanInput,
	GenerationPlanItem,
	GenerationPlanOptions,
	GenerationPlanResult,
	GenerationPlanSummaryCounts,
	GenerationReadiness,
	GenerationStalenessReason,
} from './generation-planner-types.js';

// ---------------------------------------------------------------------------
// Step 5.2 — Canonical Markdown Renderer
// ---------------------------------------------------------------------------

export type { RenderFromPlanInput } from './canonical-markdown-renderer.js';
export {
	renderCanonicalMarkdownDocument,
	renderCanonicalMarkdownFromPlan,
} from './canonical-markdown-renderer.js';

export type {
	CanonicalMarkdownDocument,
	CanonicalMarkdownRenderDiagnostic,
	CanonicalMarkdownRenderInput,
	CanonicalMarkdownRenderOptions,
	CanonicalMarkdownRenderResult,
	ConfirmedStateCollections,
	MarkdownGapMarker,
	MarkdownLanguagePolicy,
	MarkdownMetadataHeader,
	MarkdownQualityNote,
	MarkdownSectionRenderStatus,
	MarkdownSourceReference,
	MarkdownTraceabilityReference,
	RenderedMarkdownSection,
	SectionRenderContext,
} from './markdown-renderer-types.js';

// ---------------------------------------------------------------------------
// Step 5.3 — Safe Markdown Writer
// ---------------------------------------------------------------------------

export type {
	GeneratedMarkdownMetadata,
	ManualEditDetectionInput,
	ManualEditDetectionResult,
	ManualEditFsAdapter,
	ManualEditStatus,
	MarkdownChecksum,
	MarkdownFileMetadata,
	MarkdownFileTraceabilityRef,
	MarkdownWriteChangedPath,
	MarkdownWriteChangedPathRole,
	MarkdownWriteCollision,
	MarkdownWriteDiagnostic,
	MarkdownWritePlan,
	MarkdownWritePlanItem,
	MarkdownWritePlanSummary,
	MarkdownWriteStatus,
	SafeMarkdownWriteInput,
	SafeMarkdownWriteOptions,
	SafeMarkdownWritePolicy,
	SafeMarkdownWriteResult,
} from './markdown-writer-types.js';
export {
	computeBodyChecksum,
	computeFullChecksum,
	detectManualEdit,
	injectChecksumIntoMarkdown,
	parseFrontmatter,
	planMarkdownWrites,
	resolveMarkdownWriteAction,
	writeMarkdownDocuments,
} from './safe-markdown-writer.js';

// ---------------------------------------------------------------------------
// Step 5.4 — Generate Canonical Docs (orchestration)
// ---------------------------------------------------------------------------

export {
	executeGenerateCanonicalDocs,
	generateCanonicalDocs,
	planGenerateCanonicalDocs,
} from './generate-canonical-docs.js';
export type {
	GenerateCanonicalDocsDiagnostic,
	GenerateCanonicalDocsDryRunResult,
	GenerateCanonicalDocsMode,
	GenerateCanonicalDocsOptions,
	GenerateCanonicalDocsPreflight,
	GenerateCanonicalDocsReportItem,
	GenerateCanonicalDocsResult,
	GenerateCanonicalDocsWritePolicy,
} from './generate-types.js';

// ---------------------------------------------------------------------------
// Phase 7 — Unified Generation (canonical + derived HTML + Agent Packs)
// ---------------------------------------------------------------------------

export {
	executeUnifiedGeneration,
	planUnifiedDryRun,
	planUnifiedGeneration,
	unifiedGeneration,
} from './unified-generation.js';

export type {
	ArtifactCanonicality,
	DerivedArtifactResult,
	DerivedArtifactType,
	DerivedPlanItem,
	UnifiedDiagnostic,
	UnifiedGenerationDryRunResult,
	UnifiedGenerationOptions,
	UnifiedGenerationOverallStatus,
	UnifiedGenerationPreflight,
	UnifiedGenerationReport,
	UnifiedGenerationReportCounts,
	UnifiedGenerationReportCountsByType,
	UnifiedGenerationScope,
} from './unified-generation-types.js';
export {
	createUnifiedDiagnostic,
	derivedPlanStatusToWriteStatus,
	UNIFIED_GENERATION_DIAGNOSTIC_CODES,
	zeroUnifiedCounts,
} from './unified-generation-types.js';
