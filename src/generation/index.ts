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
