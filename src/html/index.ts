/** Step 9.1 — HTML Artifact Planner barrel exports */

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
