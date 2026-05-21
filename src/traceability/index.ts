/** Step 8.4 — Traceability module barrel exports */

export type {
	AgentPackTraceabilityInput,
	CanonicalMarkdownTraceabilityInput,
	DiagnosticReportTraceabilityInput,
	ExecutiveExportTraceabilityInput,
	HtmlArtifactTraceabilityInput,
} from './traceability-metadata.js';
export {
	buildAgentPackTraceabilityMetadata,
	buildCanonicalMarkdownTraceabilityMetadata,
	buildDiagnosticReportTraceabilityMetadata,
	buildExecutiveExportTraceabilityMetadata,
	buildHtmlArtifactTraceabilityMetadata,
	buildValidationReportTraceabilityMetadata,
	getBoundaryLabel,
	getOutputKindLabel,
} from './traceability-metadata.js';
export {
	buildTraceabilityRegisterSummary,
	buildTraceabilityResult,
	makePortablePath,
	renderMetadataHeaderAddon,
	renderPortablePath,
	renderTraceabilityClaimListMarkdown,
	renderTraceabilitySectionMarkdown,
	renderTraceabilitySourceListMarkdown,
	renderTraceabilitySummaryMarkdown,
	sortTraceabilityClaims,
	sortTraceabilitySources,
	toTraceabilityClaimItem,
	toTraceabilitySourceItem,
} from './traceability-renderer.js';
export type {
	OutputTraceabilityInput,
	OutputTraceabilityOptions,
	OutputTraceabilityResult,
	PortableSourcePath,
	RenderedTraceabilityJson,
	RenderedTraceabilityMarkdown,
	TraceabilityClaimItem,
	TraceabilityClaimList,
	TraceabilityDiagnostic,
	TraceabilityMetadata,
	TraceabilityOutputBoundary,
	TraceabilityOutputKind,
	TraceabilityRegisterSummary,
	TraceabilityReviewMarker,
	TraceabilitySection,
	TraceabilitySectionItem,
	TraceabilitySourceItem,
	TraceabilitySourceList,
} from './traceability-types.js';
