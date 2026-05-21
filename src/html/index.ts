/** Step 9.1 + 9.2 — HTML Artifact Planner and Static HTML Renderer barrel exports */

export type { DiscoverDeclarationsResult } from './html-artifact-declarations.js';
export {
	discoverHtmlArtifactDeclarations,
	isHtmlOutputPathSafe,
	resolveHtmlOutputPath,
} from './html-artifact-declarations.js';

export {
	createHtmlArtifactPlan,
	summarizeHtmlArtifactPlan,
} from './html-artifact-planner.js';

export type {
	HtmlArtifactAction,
	HtmlArtifactBlocker,
	HtmlArtifactDeclaration,
	HtmlArtifactDeclarationSource,
	HtmlArtifactDependency,
	HtmlArtifactDiagnostic,
	HtmlArtifactKind,
	HtmlArtifactOutputPath,
	HtmlArtifactPlan,
	HtmlArtifactPlanInput,
	HtmlArtifactPlanItem,
	HtmlArtifactPlanOptions,
	HtmlArtifactPlanResult,
	HtmlArtifactReadiness,
	HtmlArtifactReasonCode,
	HtmlArtifactSource,
	HtmlArtifactSourceKind,
	HtmlArtifactStatus,
	HtmlArtifactSummary,
} from './html-artifact-types.js';
export {
	HTML_ARTIFACT_KIND_ORDER,
	HTML_ARTIFACT_STATUS_ORDER,
} from './html-artifact-types.js';

// ---------------------------------------------------------------------------
// Step 9.2 — Safe Static HTML Renderer
// ---------------------------------------------------------------------------

export {
	escapeHtmlAttribute,
	escapeHtmlText,
	escapePathForDisplay,
	isUnsafeHtmlAttribute,
	looksLikeSecretValue,
	markAsTrusted,
	normalizePathSeparators,
	redactSecretString,
	sanitizeCssClassToken,
	sanitizeLocalHref,
	sanitizeTextContent,
} from './html-escaping.js';
export {
	buildDocumentWrappers,
	renderDerivedArtifactWarning,
	renderDiagnosticsSection,
	renderHtmlDocumentEnd,
	renderHtmlDocumentStart,
	renderMetadataBlock,
	renderThemeCss,
} from './html-layout.js';
export type {
	HtmlEscapedString,
	HtmlRenderArtifact,
	HtmlRenderBoundary,
	HtmlRenderDecisionData,
	HtmlRenderDiagnostic,
	HtmlRenderDocumentData,
	HtmlRendererMetadata,
	HtmlRendererTheme,
	HtmlRenderInput,
	HtmlRenderOptions,
	HtmlRenderPhaseData,
	HtmlRenderResult,
	HtmlRenderRiskData,
	HtmlRenderSection,
	HtmlRenderSectionKind,
	HtmlRenderSecuritySummary,
	HtmlRenderSource,
	HtmlRenderStatus,
	HtmlRenderSummaryData,
	HtmlRenderTraceabilityClaimItem,
	HtmlRenderTraceabilityData,
	HtmlRenderTraceabilitySourceItem,
	HtmlRenderValidationFindingData,
	HtmlTrustedTemplate,
	SanitizedHrefResult,
	StaticHtmlRenderer,
} from './html-render-types.js';
export {
	DEFAULT_HTML_RENDERER_THEME,
	HTML_RENDER_BOUNDARY_ORDER,
	HTML_RENDER_SECTION_KIND_ORDER,
	HTML_RENDER_STATUS_ORDER,
} from './html-render-types.js';
export {
	renderDecisionListSection,
	renderDocumentListSection,
	renderEmptyStateSection,
	renderPhaseListSection,
	renderReadinessStatusSection,
	renderRiskListSection,
	renderSourceReferencesSection,
	renderSummarySection,
	renderTraceabilitySection,
	renderValidationFindingsSection,
} from './renderer-sections.js';
export {
	createStaticHtmlRenderer,
	renderHtmlDocument,
	renderStaticHtmlArtifact,
	staticHtmlRenderer,
} from './static-html-renderer.js';

// ---------------------------------------------------------------------------
// Step 9.3 — HTML Review View Generation
// ---------------------------------------------------------------------------

export type {
	HtmlReviewArtifactRecord,
	HtmlReviewChangedPath,
	HtmlReviewGenerationDiagnostic,
	HtmlReviewGenerationInput,
	HtmlReviewGenerationItem,
	HtmlReviewGenerationOptions,
	HtmlReviewGenerationResult,
	HtmlReviewGenerationSecuritySummary,
	HtmlReviewGenerationStatus,
	HtmlReviewGenerationSummary,
	HtmlReviewViewDataInput,
	HtmlReviewViewKind,
	HtmlReviewWritePolicy,
} from './html-review-generation-types.js';
export { HTML_REVIEW_GENERATION_STATUS_ORDER } from './html-review-generation-types.js';
export {
	generateHtmlReviewViews,
	performSecurityAudit,
} from './html-review-generator.js';
export {
	buildDashboardViewData,
	buildDecisionMapViewData,
	buildDocumentViewData,
	buildExecutiveReadinessViewData,
	buildPhaseMapViewData,
	buildReadinessViewData,
	buildRiskMapViewData,
	buildValidationSummaryViewData,
	getViewDataBuilder,
} from './html-review-view-builders.js';
