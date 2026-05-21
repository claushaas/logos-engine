/** Step 9.2 — Safe Static HTML Renderer: deterministic, read-only, pure function */

import { sanitizeLocalHref } from './html-escaping.js';
import {
	buildDocumentWrappers,
	renderDerivedArtifactWarning,
	renderDiagnosticsSection,
	renderMetadataBlock,
} from './html-layout.js';
import type {
	HtmlRenderArtifact,
	HtmlRendererMetadata,
	HtmlRenderInput,
	HtmlRenderOptions,
	HtmlRenderResult,
	HtmlRenderSecuritySummary,
	StaticHtmlRenderer,
} from './html-render-types.js';
import {
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

// ---------------------------------------------------------------------------
// Security counters
// ---------------------------------------------------------------------------

function createEmptySecuritySummary(): HtmlRenderSecuritySummary {
	return {
		escapedContentCount: 0,
		externalAssetCount: 0,
		formTagCount: 0,
		iframeCount: 0,
		isSafe: true,
		rejectedUnsafeUrlCount: 0,
		scriptTagCount: 0,
	};
}

// ---------------------------------------------------------------------------
// Metadata builder
// ---------------------------------------------------------------------------

function buildMetadata(
	input: HtmlRenderInput,
	options: HtmlRenderOptions,
	traceabilitySummary: string | undefined,
): HtmlRendererMetadata {
	return {
		artifactId: input.artifactId,
		artifactKind: input.artifactKind,
		generatedAt: options.generatedAt,
		outputBoundary: input.outputBoundary,
		profileId: input.profileId,
		profileVersion: options.profileVersion,
		renderedAt: options.renderedAt,
		sourceCanonicalDocumentIds: input.sourceCanonicalDocumentIds,
		sourceCanonicalPaths: input.sourceCanonicalPaths,
		status: input.status,
		traceabilityBoundary: input.traceabilityBoundary,
		traceabilitySummary,
	};
}

// ---------------------------------------------------------------------------
// Build traceability summary
// ---------------------------------------------------------------------------

function buildTraceabilitySummary(
	traceability: HtmlRenderInput['traceability'],
): string | undefined {
	if (traceability === undefined) return undefined;
	const parts: string[] = [];
	if (traceability.sourceCount > 0)
		parts.push(`${traceability.sourceCount} sources`);
	if (traceability.claimCount > 0)
		parts.push(`${traceability.claimCount} claims`);
	if (traceability.reviewRequiredCount > 0)
		parts.push(`${traceability.reviewRequiredCount} review-required`);
	if (traceability.missingSourceCount > 0)
		parts.push(`${traceability.missingSourceCount} missing sources`);
	return parts.length > 0 ? parts.join(', ') : undefined;
}

function trackUrlSafetyCounts(inp: HtmlRenderInput): number {
	let rejected = 0;
	for (const p of new Set([
		...inp.sourceCanonicalPaths,
		...inp.sources
			.map((s) => s.relativePath)
			.filter((p): p is string => p !== undefined),
	])) {
		const result = sanitizeLocalHref(p);
		if (!result.safe) rejected++;
	}
	return rejected;
}

// ---------------------------------------------------------------------------
// Render content sections
// ---------------------------------------------------------------------------

function renderContentSections(inp: HtmlRenderInput): string {
	let html = '';

	for (const section of inp.sections) {
		switch (section.sectionKind) {
			case 'summary':
				if (inp.summary !== undefined) {
					html += renderSummarySection(inp.summary);
				} else {
					html += renderEmptyStateSection(
						'summary',
						'No summary data available.',
					);
				}
				break;

			case 'phase_list':
				if (inp.phases !== undefined && inp.phases.length > 0) {
					html += renderPhaseListSection(inp.phases);
				} else {
					html += renderEmptyStateSection(
						'phase_list',
						'No phase data available.',
					);
				}
				break;

			case 'document_list':
				if (inp.documents !== undefined && inp.documents.length > 0) {
					html += renderDocumentListSection(inp.documents);
				} else {
					html += renderEmptyStateSection(
						'document_list',
						'No document data available.',
					);
				}
				break;

			case 'decision_list':
				if (inp.decisions !== undefined && inp.decisions.length > 0) {
					html += renderDecisionListSection(inp.decisions);
				} else {
					html += renderEmptyStateSection(
						'decision_list',
						'No decision data available.',
					);
				}
				break;

			case 'risk_list':
				if (inp.risks !== undefined && inp.risks.length > 0) {
					html += renderRiskListSection(inp.risks);
				} else {
					html += renderEmptyStateSection(
						'risk_list',
						'No risk data available.',
					);
				}
				break;

			case 'validation_findings':
				if (
					inp.validationFindings !== undefined &&
					inp.validationFindings.length > 0
				) {
					html += renderValidationFindingsSection(inp.validationFindings);
				} else {
					html += renderEmptyStateSection(
						'validation_findings',
						'No validation findings.',
					);
				}
				break;

			case 'readiness_status': {
				const blockers = inp.diagnostics
					.filter((d) => d.severity === 'error')
					.map((d) => `[${d.code}] ${d.message}`);
				html += renderReadinessStatusSection(inp.status, blockers, undefined);
				break;
			}

			case 'traceability_list':
				if (inp.traceability !== undefined) {
					html += renderTraceabilitySection(inp.traceability);
				} else {
					html += renderEmptyStateSection(
						'traceability_list',
						'No traceability data available.',
					);
				}
				break;

			case 'diagnostics':
				if (inp.diagnostics.length > 0) {
					html += renderDiagnosticsSection(inp.diagnostics);
				}
				break;

			case 'empty_state':
				html += renderEmptyStateSection(inp.artifactKind, section.title);
				break;

			default:
				break;
		}
	}

	if (inp.sources.length > 0) {
		html += renderSourceReferencesSection(inp.sources);
	}

	return html;
}

// ---------------------------------------------------------------------------
// Build the complete HTML document
// ---------------------------------------------------------------------------

function buildHtmlDocument(
	inp: HtmlRenderInput,
	options: HtmlRenderOptions,
): string {
	const lang = 'en';
	const theme = options.theme;
	const wrappers = buildDocumentWrappers(inp.title, lang, theme);

	const warnings: string[] = [];
	if (inp.status === 'blocked') {
		warnings.push(`This artifact is BLOCKED and cannot be treated as ready.`);
	}
	if (inp.status === 'stale') {
		warnings.push(
			`Source data is STALE. This artifact may not reflect current state.`,
		);
	}
	if (inp.status === 'missing_source') {
		warnings.push(
			`Required source data is MISSING. This artifact is incomplete.`,
		);
	}
	if (inp.status === 'requires_review') {
		warnings.push(
			`This artifact REQUIRES REVIEW before it can be treated as reliable.`,
		);
	}
	if (inp.status === 'unknown') {
		warnings.push(`Artifact status is UNKNOWN. Treat with caution.`);
	}

	let topWarningsHtml = '';
	for (const w of warnings) {
		topWarningsHtml += `<p><strong>${w}</strong></p>\n`;
	}
	const topWarningBlock =
		topWarningsHtml.length > 0
			? `<section class="warning-block" aria-label="Status warning"><h2>Status Warning</h2>\n${topWarningsHtml}</section>\n`
			: '';

	const traceabilitySummary = buildTraceabilitySummary(inp.traceability);
	const metadata = buildMetadata(inp, options, traceabilitySummary);

	const contentHtml = renderContentSections(inp);

	let doc = wrappers.documentStart;
	doc += wrappers.headerHtml;
	doc += '<main id="main-content">\n';
	doc += renderDerivedArtifactWarning();
	doc += topWarningBlock;
	doc += renderMetadataBlock({
		artifactId: metadata.artifactId,
		artifactKind: metadata.artifactKind,
		generatedAt: metadata.generatedAt,
		outputBoundary: metadata.outputBoundary,
		profileId: metadata.profileId,
		profileVersion: metadata.profileVersion,
		renderedAt: metadata.renderedAt,
		sourceCanonicalDocumentIds: metadata.sourceCanonicalDocumentIds,
		sourceCanonicalPaths: metadata.sourceCanonicalPaths,
		status: metadata.status,
		traceabilityBoundary: metadata.traceabilityBoundary,
		traceabilitySummary: metadata.traceabilitySummary,
	});
	doc += contentHtml;
	doc += '</main>\n';
	doc += wrappers.footerHtml;
	doc += wrappers.documentEnd;

	return doc;
}

// ---------------------------------------------------------------------------
// Security audit
// ---------------------------------------------------------------------------

function auditRenderedHtml(html: string): HtmlRenderSecuritySummary {
	const summary = createEmptySecuritySummary();

	const scriptTagRe = /<script[\s>]/gi;
	const scriptMatches = html.match(scriptTagRe);
	summary.scriptTagCount = scriptMatches !== null ? scriptMatches.length : 0;

	const externalLinkRe =
		/<link[^>]+rel=["']?stylesheet["']?[^>]*href=["']?https?:/gi;
	const extLinkMatches = html.match(externalLinkRe);
	summary.externalAssetCount +=
		extLinkMatches !== null ? extLinkMatches.length : 0;

	const iframeRe = /<iframe[\s>]/gi;
	const iframeMatches = html.match(iframeRe);
	summary.iframeCount = iframeMatches !== null ? iframeMatches.length : 0;

	const formRe = /<form[\s>]/gi;
	const formMatches = html.match(formRe);
	summary.formTagCount = formMatches !== null ? formMatches.length : 0;

	const remoteFontRe = /url\(['"]?https?:/gi;
	const remoteFontMatches = html.match(remoteFontRe);
	if (remoteFontMatches !== null && remoteFontMatches.length > 0) {
		summary.externalAssetCount += remoteFontMatches.length;
	}

	summary.isSafe =
		summary.scriptTagCount === 0 &&
		summary.externalAssetCount === 0 &&
		summary.iframeCount === 0 &&
		summary.formTagCount === 0;

	return summary;
}

// ---------------------------------------------------------------------------
// Main render function
// ---------------------------------------------------------------------------

function renderStaticHtmlArtifact(
	inp: HtmlRenderInput,
	options: HtmlRenderOptions,
): HtmlRenderResult {
	const html = buildHtmlDocument(inp, options);
	const securitySummary = auditRenderedHtml(html);

	const traceabilitySummary = buildTraceabilitySummary(inp.traceability);
	const metadata = buildMetadata(inp, options, traceabilitySummary);

	securitySummary.rejectedUnsafeUrlCount = trackUrlSafetyCounts(inp);

	const result: HtmlRenderArtifact = {
		artifactId: inp.artifactId,
		artifactKind: inp.artifactKind,
		changedPaths: [],
		diagnostics: inp.diagnostics,
		html,
		metadata,
		outputBoundary: inp.outputBoundary,
		readOnly: true,
		securitySummary,
		title: inp.title,
	};

	return result;
}

function renderHtmlDocument(
	inp: HtmlRenderInput,
	options: HtmlRenderOptions,
): HtmlRenderResult {
	return renderStaticHtmlArtifact(inp, options);
}

// ---------------------------------------------------------------------------
// Static HTML renderer factory
// ---------------------------------------------------------------------------

export function createStaticHtmlRenderer(): StaticHtmlRenderer {
	return {
		renderHtmlDocument,
		renderStaticHtmlArtifact,
	};
}

export { renderHtmlDocument, renderStaticHtmlArtifact };

// Default renderer instance
export const staticHtmlRenderer: StaticHtmlRenderer =
	createStaticHtmlRenderer();
