/** Step 9.2 — Section renderer primitives for static HTML artifacts */

import {
	escapeHtmlText,
	markAsTrusted,
	sanitizeLocalHref,
	sanitizeTextContent,
} from './html-escaping.js';
import type {
	HtmlRenderDecisionData,
	HtmlRenderDocumentData,
	HtmlRenderPhaseData,
	HtmlRenderRiskData,
	HtmlRenderSectionKind,
	HtmlRenderSource,
	HtmlRenderSummaryData,
	HtmlRenderTraceabilityData,
	HtmlRenderValidationFindingData,
	HtmlTrustedTemplate,
} from './html-render-types.js';

// ---------------------------------------------------------------------------
// Status badge helper
// ---------------------------------------------------------------------------

function renderStatusBadge(status: string): string {
	const safeStatus = escapeHtmlText(status);
	const cssClass = `status-badge status-${status.replace(/_/g, '-')}`;
	return `<span class="${cssClass}">${safeStatus}</span>`;
}

// ---------------------------------------------------------------------------
// Confidence helper
// ---------------------------------------------------------------------------

function renderConfidenceLabel(confidence: string): string {
	const safeConf = escapeHtmlText(confidence);
	const cssClass = `confidence-${confidence}`;
	return `<span class="${cssClass}">${safeConf}</span>`;
}

// ---------------------------------------------------------------------------
// Source link helper
// ---------------------------------------------------------------------------

function renderSourcePath(path: string | undefined): string {
	if (path === undefined || path.length === 0) return '';
	const sanitized = sanitizeLocalHref(path);
	const safePath = escapeHtmlText(path);
	if (sanitized.safe) {
		return `<span class="source-path">${safePath}</span>`;
	}
	return `<span class="source-path" title="Unsafe path">${safePath}</span>`;
}

// ---------------------------------------------------------------------------
// Summary cards
// ---------------------------------------------------------------------------

export function renderSummarySection(
	data: HtmlRenderSummaryData,
): HtmlTrustedTemplate {
	const fields: { label: string; value: string }[] = [];

	if (data.documentCount !== undefined)
		fields.push({ label: 'Documents', value: String(data.documentCount) });
	if (data.phaseCount !== undefined)
		fields.push({ label: 'Phases', value: String(data.phaseCount) });
	if (data.readyCount !== undefined)
		fields.push({ label: 'Ready', value: String(data.readyCount) });
	if (data.blockedCount !== undefined)
		fields.push({ label: 'Blocked', value: String(data.blockedCount) });
	if (data.staleCount !== undefined)
		fields.push({ label: 'Stale', value: String(data.staleCount) });
	if (data.missingCount !== undefined)
		fields.push({ label: 'Missing', value: String(data.missingCount) });
	if (data.validationFindingCount !== undefined)
		fields.push({
			label: 'Validation Findings',
			value: String(data.validationFindingCount),
		});
	if (data.registerCount !== undefined)
		fields.push({ label: 'Register Items', value: String(data.registerCount) });
	if (data.traceabilityCount !== undefined)
		fields.push({
			label: 'Traceability Items',
			value: String(data.traceabilityCount),
		});

	if (data.extraFields !== undefined) {
		for (const [key, value] of Object.entries(data.extraFields)) {
			fields.push({ label: key, value });
		}
	}

	if (fields.length === 0) return markAsTrusted('');

	let html = '<section>\n<h2>Summary</h2>\n<div class="card-grid">\n';
	for (const field of fields) {
		const safeLabel = escapeHtmlText(field.label);
		const safeValue = sanitizeTextContent(String(field.value));
		html += `<div class="card">\n<div class="card-label">${safeLabel}</div>\n<div class="card-value">${safeValue}</div>\n</div>\n`;
	}
	html += '</div>\n</section>\n';
	return markAsTrusted(html);
}

// ---------------------------------------------------------------------------
// Phase list
// ---------------------------------------------------------------------------

export function renderPhaseListSection(
	phases: HtmlRenderPhaseData[],
): HtmlTrustedTemplate {
	if (phases.length === 0) return markAsTrusted('');

	let html = '<section>\n<h2>Phases</h2>\n';
	html += '<table>\n<thead>\n<tr>\n';
	html +=
		'<th>Phase</th><th>Order</th><th>Documents</th><th>Ready</th><th>Blocked</th><th>Stale</th><th>Status</th>\n';
	html += '</tr>\n</thead>\n<tbody>\n';

	for (const phase of phases) {
		const safeId = escapeHtmlText(phase.phaseId);
		const safeTitle = escapeHtmlText(phase.title);
		const safeOrder = escapeHtmlText(String(phase.order));
		const safeDocCount = escapeHtmlText(String(phase.documentCount));
		const safeReadyCount = escapeHtmlText(String(phase.readyCount));
		const safeBlockedCount = escapeHtmlText(String(phase.blockedCount));
		const safeStaleCount = escapeHtmlText(String(phase.staleCount));

		html += '<tr>\n';
		html += `<td><strong>${safeTitle}</strong><br><small class="status-missing_source">${safeId}</small></td>\n`;
		html += `<td>${safeOrder}</td>\n`;
		html += `<td>${safeDocCount}</td>\n`;
		html += `<td>${safeReadyCount}</td>\n`;
		html += `<td>${safeBlockedCount}</td>\n`;
		html += `<td>${safeStaleCount}</td>\n`;
		html += `<td>${renderStatusBadge(phase.status)}</td>\n`;
		html += '</tr>\n';
	}

	html += '</tbody>\n</table>\n</section>\n';
	return markAsTrusted(html);
}

// ---------------------------------------------------------------------------
// Document list
// ---------------------------------------------------------------------------

export function renderDocumentListSection(
	documents: HtmlRenderDocumentData[],
): HtmlTrustedTemplate {
	if (documents.length === 0) return markAsTrusted('');

	let html = '<section>\n<h2>Documents</h2>\n';
	html += '<table>\n<thead>\n<tr>\n';
	html +=
		'<th>Document</th><th>Phase</th><th>Status</th><th>Staleness</th><th>Source Path</th>\n';
	html += '</tr>\n</thead>\n<tbody>\n';

	for (const doc of documents) {
		const safeId = escapeHtmlText(doc.documentCanonicalId);
		const safeTitle = escapeHtmlText(doc.title);
		const safePhaseId = escapeHtmlText(doc.phaseId);
		const staleBadge =
			doc.staleStatus !== undefined
				? renderStatusBadge(doc.staleStatus)
				: '<span class="status-missing_source">—</span>';

		html += '<tr>\n';
		html += `<td><strong>${safeTitle}</strong><br><small class="status-missing_source">${safeId}</small></td>\n`;
		html += `<td>${safePhaseId}</td>\n`;
		html += `<td>${renderStatusBadge(doc.status)}</td>\n`;
		html += `<td>${staleBadge}</td>\n`;
		html += `<td>${renderSourcePath(doc.canonicalSourcePath)}</td>\n`;
		html += '</tr>\n';
	}

	html += '</tbody>\n</table>\n</section>\n';
	return markAsTrusted(html);
}

// ---------------------------------------------------------------------------
// Decision list
// ---------------------------------------------------------------------------

export function renderDecisionListSection(
	decisions: HtmlRenderDecisionData[],
): HtmlTrustedTemplate {
	if (decisions.length === 0) return markAsTrusted('');

	let html = '<section>\n<h2>Decisions</h2>\n';
	html += '<table>\n<thead>\n<tr>\n';
	html +=
		'<th>ID</th><th>Title / Summary</th><th>Status</th><th>Confidence</th><th>Review</th><th>Affected Documents</th>\n';
	html += '</tr>\n</thead>\n<tbody>\n';

	for (const decision of decisions) {
		const safeId = escapeHtmlText(decision.id);
		const safeTitle = sanitizeTextContent(decision.title);
		const safeSummary = sanitizeTextContent(decision.summary);
		const safeDocIds = escapeHtmlText(
			decision.affectedDocumentIds.join(', ') || '—',
		);
		const inferredLabel = decision.isInferred
			? ' <span class="review-marker-required">[INFERRED]</span>'
			: '';
		const reviewRequiredLabel = decision.reviewRequired
			? ' <span class="review-marker-required">[REVIEW REQUIRED]</span>'
			: '';
		const reviewMarker =
			decision.reviewState !== 'not_required'
				? ` <span class="${decision.reviewState === 'requires_review' || decision.reviewState === 'blocked' ? 'review-marker-required' : decision.reviewState === 'approved' ? 'review-marker-approved' : ''}">[${escapeHtmlText(decision.reviewState.toUpperCase())}]</span>`
				: '';

		html += '<tr>\n';
		html += `<td>${safeId}${inferredLabel}${reviewRequiredLabel}</td>\n`;
		html += `<td><strong>${safeTitle}</strong><br>${safeSummary}</td>\n`;
		html += `<td>${renderStatusBadge(decision.status)}</td>\n`;
		html += `<td>${renderConfidenceLabel(decision.confidence)}</td>\n`;
		html += `<td>${reviewMarker}</td>\n`;
		html += `<td>${safeDocIds}</td>\n`;
		html += '</tr>\n';
	}

	html += '</tbody>\n</table>\n</section>\n';
	return markAsTrusted(html);
}

// ---------------------------------------------------------------------------
// Risk list
// ---------------------------------------------------------------------------

export function renderRiskListSection(
	risks: HtmlRenderRiskData[],
): HtmlTrustedTemplate {
	if (risks.length === 0) return markAsTrusted('');

	let html = '<section>\n<h2>Risks</h2>\n';
	html += '<table>\n<thead>\n<tr>\n';
	html +=
		'<th>ID</th><th>Title / Summary</th><th>Status</th><th>Confidence</th><th>Mitigation</th><th>Affected Documents</th>\n';
	html += '</tr>\n</thead>\n<tbody>\n';

	for (const risk of risks) {
		const safeId = escapeHtmlText(risk.id);
		const safeTitle = sanitizeTextContent(risk.title);
		const safeSummary = sanitizeTextContent(risk.summary);
		const safeMitigation =
			risk.mitigation !== undefined
				? sanitizeTextContent(risk.mitigation)
				: '—';
		const safeDocIds = escapeHtmlText(
			risk.affectedDocumentIds.join(', ') || '—',
		);
		const inferredLabel = risk.isInferred
			? ' <span class="review-marker-required">[INFERRED]</span>'
			: '';
		const reviewRequiredLabel = risk.reviewRequired
			? ' <span class="review-marker-required">[REVIEW REQUIRED]</span>'
			: '';

		html += '<tr>\n';
		html += `<td>${safeId}${inferredLabel}${reviewRequiredLabel}</td>\n`;
		html += `<td><strong>${safeTitle}</strong><br>${safeSummary}</td>\n`;
		html += `<td>${renderStatusBadge(risk.status)}</td>\n`;
		html += `<td>${renderConfidenceLabel(risk.confidence)}</td>\n`;
		html += `<td>${safeMitigation}</td>\n`;
		html += `<td>${safeDocIds}</td>\n`;
		html += '</tr>\n';
	}

	html += '</tbody>\n</table>\n</section>\n';
	return markAsTrusted(html);
}

// ---------------------------------------------------------------------------
// Validation findings
// ---------------------------------------------------------------------------

export function renderValidationFindingsSection(
	findings: HtmlRenderValidationFindingData[],
): HtmlTrustedTemplate {
	if (findings.length === 0) return markAsTrusted('');

	const fatalFindings = findings.filter(
		(f) => f.severity === 'error' || f.severity === 'fatal',
	);
	const warningFindings = findings.filter((f) => f.severity === 'warning');
	const infoFindings = findings.filter((f) => f.severity === 'info');

	let html = '<section>\n<h2>Validation Findings</h2>\n';

	if (fatalFindings.length > 0) {
		html += '<h3>Blockers & Errors</h3>\n';
		html += '<table>\n<thead>\n<tr>\n';
		html +=
			'<th>Severity</th><th>Code</th><th>Message</th><th>Document / Phase</th><th>Path / Pointer</th><th>Recovery</th>\n';
		html += '</tr>\n</thead>\n<tbody>\n';
		for (const finding of fatalFindings) {
			const safeSeverity = escapeHtmlText(finding.severity);
			const safeCode = escapeHtmlText(finding.code);
			const safeMessage = sanitizeTextContent(finding.message);
			const safeDoc = finding.documentCanonicalId ?? '—';
			const safePhase = finding.phaseId ?? '—';
			const safePath = sanitizeTextContent(finding.path ?? '—');
			const safePointer = sanitizeTextContent(finding.pointer ?? '');
			const safeRecovery =
				finding.recoveryHint !== undefined
					? sanitizeTextContent(finding.recoveryHint)
					: '—';
			const severityClass = `severity-${escapeHtmlText(finding.severity)}`;

			html += '<tr>\n';
			html += `<td><span class="${severityClass}">${safeSeverity.toUpperCase()}</span>${finding.isReleaseBlocker ? ' <span class="release-blocker-tag">BLOCKER</span>' : ''}</td>\n`;
			html += `<td>${safeCode}</td>\n`;
			html += `<td>${safeMessage}</td>\n`;
			html += `<td>${escapeHtmlText(safeDoc)} / ${escapeHtmlText(safePhase)}</td>\n`;
			html += `<td class="source-path">${escapeHtmlText(safePath)}${safePointer.length > 0 ? ` / ${escapeHtmlText(safePointer)}` : ''}</td>\n`;
			html += `<td>${safeRecovery}</td>\n`;
			html += '</tr>\n';
		}
		html += '</tbody>\n</table>\n';
	}

	if (warningFindings.length > 0) {
		html += '<h3>Warnings</h3>\n';
		html += '<table>\n<thead>\n<tr>\n';
		html +=
			'<th>Severity</th><th>Code</th><th>Message</th><th>Document / Phase</th><th>Path / Pointer</th><th>Recovery</th>\n';
		html += '</tr>\n</thead>\n<tbody>\n';
		for (const finding of warningFindings) {
			const safeSeverity = escapeHtmlText(finding.severity);
			const safeCode = escapeHtmlText(finding.code);
			const safeMessage = sanitizeTextContent(finding.message);
			const safeDoc = finding.documentCanonicalId ?? '—';
			const safePhase = finding.phaseId ?? '—';
			const safePath = sanitizeTextContent(finding.path ?? '—');
			const safePointer = sanitizeTextContent(finding.pointer ?? '');
			const safeRecovery =
				finding.recoveryHint !== undefined
					? sanitizeTextContent(finding.recoveryHint)
					: '—';
			const severityClass = `severity-${escapeHtmlText(finding.severity)}`;

			html += '<tr>\n';
			html += `<td><span class="${severityClass}">${safeSeverity.toUpperCase()}</span></td>\n`;
			html += `<td>${safeCode}</td>\n`;
			html += `<td>${safeMessage}</td>\n`;
			html += `<td>${escapeHtmlText(safeDoc)} / ${escapeHtmlText(safePhase)}</td>\n`;
			html += `<td class="source-path">${escapeHtmlText(safePath)}${safePointer.length > 0 ? ` / ${escapeHtmlText(safePointer)}` : ''}</td>\n`;
			html += `<td>${safeRecovery}</td>\n`;
			html += '</tr>\n';
		}
		html += '</tbody>\n</table>\n';
	}

	if (infoFindings.length > 0) {
		html += '<h3>Info</h3>\n';
		html += '<table>\n<thead>\n<tr>\n';
		html +=
			'<th>Severity</th><th>Code</th><th>Message</th><th>Document / Phase</th>\n';
		html += '</tr>\n</thead>\n<tbody>\n';
		for (const finding of infoFindings) {
			const safeSeverity = escapeHtmlText(finding.severity);
			const safeCode = escapeHtmlText(finding.code);
			const safeMessage = escapeHtmlText(finding.message);
			const safeDoc = finding.documentCanonicalId ?? '—';
			const safePhase = finding.phaseId ?? '—';

			html += '<tr>\n';
			html += `<td><span class="severity-info">${safeSeverity.toUpperCase()}</span></td>\n`;
			html += `<td>${safeCode}</td>\n`;
			html += `<td>${safeMessage}</td>\n`;
			html += `<td>${escapeHtmlText(safeDoc)} / ${escapeHtmlText(safePhase)}</td>\n`;
			html += '</tr>\n';
		}
		html += '</tbody>\n</table>\n';
	}

	html += '</section>\n';
	return markAsTrusted(html);
}

// ---------------------------------------------------------------------------
// Readiness status
// ---------------------------------------------------------------------------

export function renderReadinessStatusSection(
	status: string,
	blockers: string[],
	gateStatus: string | undefined,
): HtmlTrustedTemplate {
	let html = '<section>\n<h2>Readiness Status</h2>\n';

	html += `<p>Status: ${renderStatusBadge(status)}</p>\n`;

	if (gateStatus !== undefined) {
		const safeGateStatus = escapeHtmlText(gateStatus);
		html += `<p>Gate: <strong>${safeGateStatus}</strong></p>\n`;
	}

	if (blockers.length > 0) {
		html += '<h3>Blockers</h3>\n<ul>\n';
		for (const blocker of blockers) {
			html += `<li class="diagnostic-error">${escapeHtmlText(blocker)}</li>\n`;
		}
		html += '</ul>\n';
	} else {
		html += '<p>No blockers detected.</p>\n';
	}

	html += '</section>\n';
	return markAsTrusted(html);
}

// ---------------------------------------------------------------------------
// Traceability source list
// ---------------------------------------------------------------------------

export function renderTraceabilitySection(
	data: HtmlRenderTraceabilityData,
): HtmlTrustedTemplate {
	let html = '<section>\n<h2>Traceability</h2>\n';

	html += '<div class="card-grid">\n';
	html += `<div class="card"><div class="card-label">Sources</div><div class="card-value">${escapeHtmlText(String(data.sourceCount))}</div></div>\n`;
	html += `<div class="card"><div class="card-label">Claims</div><div class="card-value">${escapeHtmlText(String(data.claimCount))}</div></div>\n`;
	html += `<div class="card"><div class="card-label">Review Required</div><div class="card-value">${escapeHtmlText(String(data.reviewRequiredCount))}</div></div>\n`;
	html += `<div class="card"><div class="card-label">Inferred</div><div class="card-value">${escapeHtmlText(String(data.inferredClaimCount))}</div></div>\n`;
	html += `<div class="card"><div class="card-label">Missing Sources</div><div class="card-value">${escapeHtmlText(String(data.missingSourceCount))}</div></div>\n`;
	html += '</div>\n';

	if (data.sources.length > 0) {
		html += '<h3>Sources</h3>\n';
		html += '<table>\n<thead>\n<tr>\n';
		html +=
			'<th>ID</th><th>Type</th><th>Title</th><th>Status</th><th>Confidence</th><th>Review</th>\n';
		html += '</tr>\n</thead>\n<tbody>\n';
		for (const source of data.sources) {
			const safeId = escapeHtmlText(source.sourceId);
			const safeType = escapeHtmlText(source.sourceType);
			const safeTitle = escapeHtmlText(source.title);
			const reviewMarker =
				source.reviewMarker !== undefined &&
				source.reviewMarker !== 'not_required'
					? ` <span class="${source.reviewMarker === 'requires_review' || source.reviewMarker === 'blocked' ? 'review-marker-required' : source.reviewMarker === 'approved' ? 'review-marker-approved' : ''}">[${escapeHtmlText(source.reviewMarker.toUpperCase())}]</span>`
					: '';
			const missingSourceMarker =
				source.status === 'missing' || source.status === 'unknown'
					? ' <span class="missing-source-marker">[MISSING]</span>'
					: '';

			html += '<tr>\n';
			html += `<td>${safeId}${missingSourceMarker}</td>\n`;
			html += `<td>${safeType}</td>\n`;
			html += `<td>${safeTitle}</td>\n`;
			html += `<td>${renderStatusBadge(source.status)}</td>\n`;
			html += `<td>${renderConfidenceLabel(source.confidence)}</td>\n`;
			html += `<td>${reviewMarker}</td>\n`;
			html += '</tr>\n';
		}
		html += '</tbody>\n</table>\n';
	}

	if (data.claims.length > 0) {
		html += '<h3>Claims</h3>\n';
		html += '<table>\n<thead>\n<tr>\n';
		html +=
			'<th>ID</th><th>Type</th><th>Summary</th><th>Status</th><th>Confidence</th><th>Review</th><th>Inferred</th>\n';
		html += '</tr>\n</thead>\n<tbody>\n';
		for (const claim of data.claims) {
			const safeId = escapeHtmlText(claim.claimId);
			const safeType = escapeHtmlText(claim.claimType);
			const safeSummary = escapeHtmlText(claim.shortSummary);
			const inferredLabel = claim.isInferred
				? ' <span class="review-marker-required">[INFERRED]</span>'
				: '';
			const reviewRequiredLabel = claim.reviewRequiredMarker
				? ' <span class="review-marker-required">[REVIEW REQUIRED]</span>'
				: '';
			const reviewStateLabel =
				claim.reviewState !== 'not_required'
					? ` <span class="${claim.reviewState === 'requires_review' || claim.reviewState === 'blocked' ? 'review-marker-required' : claim.reviewState === 'approved' ? 'review-marker-approved' : ''}">[${escapeHtmlText(claim.reviewState.toUpperCase())}]</span>`
					: '';

			html += '<tr>\n';
			html += `<td>${safeId}${inferredLabel}</td>\n`;
			html += `<td>${safeType}</td>\n`;
			html += `<td>${safeSummary}</td>\n`;
			html += `<td>${renderStatusBadge(claim.status)}${reviewRequiredLabel}</td>\n`;
			html += `<td>${renderConfidenceLabel(claim.confidence)}</td>\n`;
			html += `<td>${reviewStateLabel}</td>\n`;
			html += `<td>${escapeHtmlText(String(claim.isInferred))}</td>\n`;
			html += '</tr>\n';
		}
		html += '</tbody>\n</table>\n';
	}

	html += '</section>\n';
	return markAsTrusted(html);
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

export function renderEmptyStateSection(
	kind: HtmlRenderSectionKind | string,
	message?: string | undefined,
): HtmlTrustedTemplate {
	const safeKind = escapeHtmlText(kind);
	const safeMessage =
		message !== undefined
			? escapeHtmlText(message)
			: `No ${escapeHtmlText(kind.replace(/_/g, ' '))} data available.`;
	return markAsTrusted(
		`<section>\n<h2>${safeKind.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</h2>\n<div class="empty-state"><p>${safeMessage}</p></div>\n</section>\n`,
	);
}

// ---------------------------------------------------------------------------
// Source references list
// ---------------------------------------------------------------------------

export function renderSourceReferencesSection(
	sources: HtmlRenderSource[],
): HtmlTrustedTemplate {
	if (sources.length === 0) return markAsTrusted('');

	let html = '<section>\n<h2>Source References</h2>\n';
	html += '<ul class="source-list">\n';
	for (const source of sources) {
		const safeLabel =
			source.label !== undefined
				? escapeHtmlText(source.label)
				: escapeHtmlText(source.sourceId);
		const safeSourceId = escapeHtmlText(source.sourceId);
		const safeSourceKind = escapeHtmlText(source.sourceKind);
		const safeStatus =
			source.status !== undefined ? renderStatusBadge(source.status) : '';
		const pathHtml = renderSourcePath(source.relativePath);

		html += '<li>\n';
		html += `<strong>${safeLabel}</strong> `;
		html += `(${safeSourceId}, ${safeSourceKind}) `;
		if (safeStatus.length > 0) html += safeStatus;
		if (pathHtml.length > 0) html += `<br>${pathHtml}`;
		html += '\n</li>\n';
	}
	html += '</ul>\n</section>\n';
	return markAsTrusted(html);
}
