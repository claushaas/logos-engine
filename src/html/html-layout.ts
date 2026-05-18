/** Step 9.2 — Static HTML document layout helpers */

import {
	escapeHtmlAttribute,
	escapeHtmlText,
	markAsTrusted,
	sanitizeCssClassToken,
	sanitizeTextContent,
} from './html-escaping.js';
import type {
	HtmlRendererTheme,
	HtmlTrustedTemplate,
} from './html-render-types.js';
import { DEFAULT_HTML_RENDERER_THEME } from './html-render-types.js';

export function renderThemeCss(theme: HtmlRendererTheme): HtmlTrustedTemplate {
	const safeTheme = sanitizeTheme(theme);
	return markAsTrusted(`:root {
  --font-family: ${safeTheme.fontFamily};
  --bg-color: ${safeTheme.backgroundColor};
  --text-color: ${safeTheme.textColor};
  --header-color: ${safeTheme.headerColor};
  --border-color: ${safeTheme.borderColor};
  --warning-color: ${safeTheme.warningColor};
  --error-color: ${safeTheme.errorColor};
  --info-color: ${safeTheme.infoColor};
  --success-color: ${safeTheme.successColor};
  --link-color: ${safeTheme.linkColor};
  --muted-color: ${safeTheme.mutedColor};
}
*,
*::before,
*::after {
  box-sizing: border-box;
}
body {
  font-family: var(--font-family);
  background: var(--bg-color);
  color: var(--text-color);
  line-height: 1.6;
  margin: 0;
  padding: 0;
}
.skip-link {
  position: absolute;
  top: -100%;
  left: 0;
  background: var(--info-color);
  color: #fff;
  padding: 0.5em 1em;
  z-index: 1000;
}
.skip-link:focus {
  top: 0;
}
header {
  border-bottom: 2px solid var(--border-color);
  padding: 1.5em 2em;
  background: #f9fafb;
}
header h1 {
  margin: 0 0 0.25em 0;
  font-size: 1.5em;
  color: var(--header-color);
}
.artifact-kind {
  font-size: 0.875em;
  color: var(--muted-color);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
main {
  max-width: 960px;
  margin: 0 auto;
  padding: 1em 2em 3em 2em;
}
section {
  margin: 1.5em 0;
}
h2 {
  font-size: 1.25em;
  border-bottom: 1px solid var(--border-color);
  padding-bottom: 0.25em;
  margin: 1.5em 0 0.75em 0;
  color: var(--header-color);
}
h3 {
  font-size: 1.1em;
  margin: 1em 0 0.5em 0;
  color: var(--header-color);
}
.warning-block {
  background: #fef3c7;
  border: 1px solid #f59e0b;
  border-left: 4px solid #f59e0b;
  padding: 1em;
  margin: 1em 0;
  border-radius: 0.25em;
}
.warning-block strong {
  color: #92400e;
}
.warning-block p {
  margin: 0.25em 0;
}
.metadata-block {
  background: #f3f4f6;
  border: 1px solid var(--border-color);
  padding: 1em;
  margin: 1em 0;
  border-radius: 0.25em;
  font-size: 0.875em;
}
.metadata-block dl {
  margin: 0;
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.25em 1em;
}
.metadata-block dt {
  font-weight: 600;
  color: var(--muted-color);
}
.metadata-block dd {
  margin: 0;
}
.status-badge {
  display: inline-block;
  padding: 0.15em 0.6em;
  border-radius: 0.25em;
  font-size: 0.8em;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}
.status-ready { background: #d1fae5; color: #065f46; }
.status-blocked { background: #fee2e2; color: #991b1b; }
.status-stale { background: #fef3c7; color: #92400e; }
.status-missing_source { background: #fee2e2; color: #991b1b; }
.status-requires_review { background: #fef3c7; color: #92400e; }
.status-unknown { background: #f3f4f6; color: #6b7280; }
.status-skipped { background: #f3f4f6; color: #6b7280; }
table {
  width: 100%;
  border-collapse: collapse;
  margin: 0.75em 0;
}
th, td {
  text-align: left;
  padding: 0.5em 0.75em;
  border: 1px solid var(--border-color);
}
th {
  background: #f9fafb;
  font-weight: 600;
  color: var(--header-color);
}
tr:nth-child(even) td {
  background: #f9fafb;
}
.source-list {
  list-style: none;
  padding: 0;
  margin: 0.5em 0;
}
.source-list li {
  padding: 0.35em 0;
  border-bottom: 1px solid #f3f4f6;
  font-size: 0.9em;
}
.source-list li:last-child {
  border-bottom: none;
}
.source-path {
  font-family: ui-monospace, "Cascadia Code", "Source Code Pro", Menlo, Consolas, monospace;
  font-size: 0.85em;
}
.diagnostic {
  padding: 0.5em 0.75em;
  margin: 0.25em 0;
  border-radius: 0.2em;
  font-size: 0.9em;
}
.diagnostic-error { background: #fee2e2; border-left: 3px solid var(--error-color); }
.diagnostic-warning { background: #fef3c7; border-left: 3px solid var(--warning-color); }
.diagnostic-info { background: #dbeafe; border-left: 3px solid var(--info-color); }
.confidence-explicit { color: var(--success-color); font-weight: 600; }
.confidence-derived { color: var(--info-color); font-weight: 600; }
.confidence-inferred { color: var(--warning-color); font-weight: 600; }
.confidence-unknown { color: var(--muted-color); }
.review-marker-required { color: var(--warning-color); font-weight: 600; }
.review-marker-approved { color: var(--success-color); }
.review-marker-blocked { color: var(--error-color); font-weight: 600; }
.missing-source-marker { color: var(--error-color); font-weight: 600; }
.empty-state {
  text-align: center;
  padding: 2em;
  color: var(--muted-color);
  font-style: italic;
}
footer {
  border-top: 1px solid var(--border-color);
  padding: 1em 2em;
  font-size: 0.8em;
  color: var(--muted-color);
  max-width: 960px;
  margin: 0 auto;
}
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 0.75em;
  margin: 0.75em 0;
}
.card {
  background: #f9fafb;
  border: 1px solid var(--border-color);
  border-radius: 0.25em;
  padding: 0.75em 1em;
}
.card-label {
  font-size: 0.8em;
  color: var(--muted-color);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}
.card-value {
  font-size: 1.5em;
  font-weight: 700;
  margin-top: 0.15em;
}
.severity-fatal { color: var(--error-color); font-weight: 700; text-transform: uppercase; }
.severity-error { color: var(--error-color); font-weight: 600; }
.severity-warning { color: var(--warning-color); font-weight: 600; }
.severity-info { color: var(--info-color); }
.release-blocker-tag {
  display: inline-block;
  background: var(--error-color);
  color: #fff;
  padding: 0.1em 0.4em;
  border-radius: 0.2em;
  font-size: 0.75em;
  font-weight: 700;
  text-transform: uppercase;
}
.phase-document-list {
  margin: 0.5em 0;
}
.phase-item {
  border: 1px solid var(--border-color);
  border-radius: 0.25em;
  padding: 0.75em 1em;
  margin: 0.5em 0;
  background: #f9fafb;
}
.phase-item h3 {
  margin: 0 0 0.25em 0;
}
`);
}

function sanitizeCssValue(value: string, fallback: string): string {
	const trimmed = value.trim();
	if (
		trimmed.length === 0 ||
		/[{};<>]/.test(trimmed) ||
		/url\s*\(/i.test(trimmed) ||
		/@import/i.test(trimmed) ||
		/https?:/i.test(trimmed) ||
		/\/\//.test(trimmed) ||
		/\b(?:javascript|data|vbscript):/i.test(trimmed)
	) {
		return fallback;
	}
	return trimmed;
}

function sanitizeTheme(theme: HtmlRendererTheme): HtmlRendererTheme {
	return {
		backgroundColor: sanitizeCssValue(
			theme.backgroundColor,
			DEFAULT_HTML_RENDERER_THEME.backgroundColor,
		),
		borderColor: sanitizeCssValue(
			theme.borderColor,
			DEFAULT_HTML_RENDERER_THEME.borderColor,
		),
		errorColor: sanitizeCssValue(
			theme.errorColor,
			DEFAULT_HTML_RENDERER_THEME.errorColor,
		),
		fontFamily: sanitizeCssValue(
			theme.fontFamily,
			DEFAULT_HTML_RENDERER_THEME.fontFamily,
		),
		headerColor: sanitizeCssValue(
			theme.headerColor,
			DEFAULT_HTML_RENDERER_THEME.headerColor,
		),
		infoColor: sanitizeCssValue(
			theme.infoColor,
			DEFAULT_HTML_RENDERER_THEME.infoColor,
		),
		linkColor: sanitizeCssValue(
			theme.linkColor,
			DEFAULT_HTML_RENDERER_THEME.linkColor,
		),
		mutedColor: sanitizeCssValue(
			theme.mutedColor,
			DEFAULT_HTML_RENDERER_THEME.mutedColor,
		),
		successColor: sanitizeCssValue(
			theme.successColor,
			DEFAULT_HTML_RENDERER_THEME.successColor,
		),
		textColor: sanitizeCssValue(
			theme.textColor,
			DEFAULT_HTML_RENDERER_THEME.textColor,
		),
		warningColor: sanitizeCssValue(
			theme.warningColor,
			DEFAULT_HTML_RENDERER_THEME.warningColor,
		),
	};
}

export function renderHtmlDocumentStart(
	title: string,
	theme: HtmlRendererTheme,
	lang: string,
): HtmlTrustedTemplate {
	const safeTitleText = escapeHtmlText(title);
	const _safeTitleAttr = escapeHtmlAttribute(title);
	const safeLang = escapeHtmlAttribute(lang);
	const themeCss = renderThemeCss(theme);
	return markAsTrusted(
		`<!doctype html>\n<html lang="${safeLang}">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1">\n<title>${safeTitleText} — logos-engine HTML artifact</title>\n<style>\n${themeCss}\n</style>\n</head>\n<body>\n<a class="skip-link" href="#main-content">Skip to main content</a>\n`,
	);
}

export function renderHtmlDocumentEnd(): HtmlTrustedTemplate {
	return markAsTrusted('</body>\n</html>\n');
}

export interface HtmlDocumentWrappers {
	documentStart: HtmlTrustedTemplate;
	documentEnd: HtmlTrustedTemplate;
	headerHtml: HtmlTrustedTemplate;
	footerHtml: HtmlTrustedTemplate;
}

export function buildDocumentWrappers(
	title: string,
	lang: string,
	theme: HtmlRendererTheme | undefined,
): HtmlDocumentWrappers {
	const t = theme ?? DEFAULT_HTML_RENDERER_THEME;
	const safeTitle = escapeHtmlText(title);

	return {
		documentEnd: renderHtmlDocumentEnd(),
		documentStart: renderHtmlDocumentStart(title, t, lang),
		footerHtml: markAsTrusted(
			`<footer>\n<p>Generated by logos-engine HTML renderer. This file is a local-only, static, read-only review artifact.</p>\n</footer>\n`,
		),
		headerHtml: markAsTrusted(
			`<header>\n<h1>${safeTitle}</h1>\n<p class="artifact-kind">logos-engine — HTML review artifact</p>\n</header>\n`,
		),
	};
}

export function renderDerivedArtifactWarning(): HtmlTrustedTemplate {
	return markAsTrusted(
		`<section class="warning-block" aria-label="Derived artifact warning">\n<h2>IMPORTANT — Derived Non-Canonical Review Artifact</h2>\n<p><strong>This HTML file is a derived, non-canonical review artifact.</strong></p>\n<p>Canonical project documentation remains in generated Markdown and structured <code>.logos/</code> state.</p>\n<p>Do not treat this HTML artifact as the source of truth.</p>\n<p>This file is for local review only. It is not intended for distribution, hosting, or external use.</p>\n</section>\n`,
	);
}

export function renderMetadataBlock(meta: {
	artifactId: string;
	artifactKind: string;
	outputBoundary: string;
	profileId: string;
	profileVersion: string | undefined;
	generatedAt: string;
	renderedAt: string;
	status: string;
	traceabilityBoundary: string;
	sourceCanonicalDocumentIds: readonly string[];
	sourceCanonicalPaths: readonly string[];
	traceabilitySummary: string | undefined;
}): HtmlTrustedTemplate {
	const safeArtifactId = escapeHtmlText(meta.artifactId);
	const safeArtifactKind = escapeHtmlText(meta.artifactKind);
	const safeOutputBoundary = escapeHtmlText(meta.outputBoundary);
	const safeProfileId = escapeHtmlText(meta.profileId);
	const safeProfileVersion =
		meta.profileVersion !== undefined
			? escapeHtmlText(meta.profileVersion)
			: undefined;
	const safeGeneratedAt = escapeHtmlText(meta.generatedAt);
	const safeRenderedAt = escapeHtmlText(meta.renderedAt);
	const safeStatus = escapeHtmlText(meta.status);
	const safeTraceabilityBoundary = escapeHtmlText(meta.traceabilityBoundary);
	const safeTraceabilitySummary =
		meta.traceabilitySummary !== undefined
			? escapeHtmlText(meta.traceabilitySummary)
			: undefined;

	const statusClass = `status-badge status-${sanitizeCssClassToken(meta.status)}`;
	const boundaryClass = `status-badge status-${sanitizeCssClassToken(meta.outputBoundary)}`;

	let html = '<section class="metadata-block">\n<h2>Metadata</h2>\n<dl>\n';
	html += `<dt>Artifact ID</dt><dd>${safeArtifactId}</dd>\n`;
	html += `<dt>Artifact kind</dt><dd>${safeArtifactKind}</dd>\n`;
	html += `<dt>Output boundary</dt><dd><span class="${boundaryClass}">${safeOutputBoundary}</span></dd>\n`;
	html += `<dt>Profile</dt><dd>${safeProfileId}${safeProfileVersion !== undefined ? ` (v${safeProfileVersion})` : ''}</dd>\n`;
	html += `<dt>Generated at</dt><dd>${safeGeneratedAt}</dd>\n`;
	html += `<dt>Rendered at</dt><dd>${safeRenderedAt}</dd>\n`;
	html += `<dt>Status</dt><dd><span class="${statusClass}">${safeStatus}</span></dd>\n`;
	html += `<dt>Traceability boundary</dt><dd>${safeTraceabilityBoundary}</dd>\n`;

	if (safeTraceabilitySummary !== undefined) {
		html += `<dt>Traceability summary</dt><dd>${safeTraceabilitySummary}</dd>\n`;
	}

	if (meta.sourceCanonicalDocumentIds.length > 0) {
		html += `<dt>Source canonical document IDs</dt><dd>${escapeHtmlText(meta.sourceCanonicalDocumentIds.join(', '))}</dd>\n`;
	}

	if (meta.sourceCanonicalPaths.length > 0) {
		html += '<dt>Source canonical paths</dt><dd><ul class="source-list">\n';
		for (const p of meta.sourceCanonicalPaths) {
			html += `<li class="source-path">${escapeHtmlText(p)}</li>\n`;
		}
		html += '</ul></dd>\n';
	}

	html += '</dl>\n</section>\n';

	return markAsTrusted(html);
}

export function renderDiagnosticsSection(
	diagnostics: readonly {
		code: string;
		severity: string;
		message: string;
		sourcePath: string | undefined;
		fieldPath: string | undefined;
		recoveryHint: string | undefined;
	}[],
): HtmlTrustedTemplate {
	if (diagnostics.length === 0) return markAsTrusted('');

	let html = '<section>\n<h2>Diagnostics</h2>\n';
	for (const diag of diagnostics) {
		const safeCode = escapeHtmlText(diag.code);
		const _safeSeverity = escapeHtmlText(diag.severity);
		const safeMessage = sanitizeTextContent(diag.message);
		const safeSourcePath =
			diag.sourcePath !== undefined
				? sanitizeTextContent(diag.sourcePath)
				: undefined;
		const safeFieldPath =
			diag.fieldPath !== undefined
				? sanitizeTextContent(diag.fieldPath)
				: undefined;
		const safeRecoveryHint =
			diag.recoveryHint !== undefined
				? sanitizeTextContent(diag.recoveryHint)
				: undefined;

		const sevClass = `diagnostic diagnostic-${sanitizeCssClassToken(diag.severity)}`;
		html += `<div class="${sevClass}">\n<strong>[${safeCode}]</strong> ${safeMessage}\n`;
		if (safeSourcePath !== undefined)
			html += `<br><span class="source-path">Source: ${safeSourcePath}</span>\n`;
		if (safeFieldPath !== undefined) html += `<br>Field: ${safeFieldPath}\n`;
		if (safeRecoveryHint !== undefined)
			html += `<br><em>Recovery: ${safeRecoveryHint}</em>\n`;
		html += '</div>\n';
	}
	html += '</section>\n';
	return markAsTrusted(html);
}
