/** Step 8.4 — Traceability rendering primitives */

import { isAbsolute, relative } from 'node:path';
import type {
	ClaimRecord,
	SourceRecord,
} from '../provenance/provenance-types.js';
import {
	CLAIM_CONFIDENCE_ORDER,
	CLAIM_REVIEW_STATE_ORDER,
	CLAIM_STATUS_ORDER,
	CLAIM_TYPE_ORDER,
	SOURCE_CONFIDENCE_ORDER,
	SOURCE_TYPE_ORDER,
} from '../provenance/provenance-types.js';
import type { RegisterCollections } from '../registers/register-types.js';
import { redactString } from '../runtime/redaction.js';
import type {
	OutputTraceabilityInput,
	OutputTraceabilityOptions,
	OutputTraceabilityResult,
	PortableSourcePath,
	TraceabilityClaimItem,
	TraceabilityConfidence,
	TraceabilityMetadata,
	TraceabilityOutputBoundary,
	TraceabilityOutputKind,
	TraceabilityRegisterSummary,
	TraceabilityReviewMarker,
	TraceabilitySourceItem,
} from './traceability-types.js';

// ---------------------------------------------------------------------------
// Boundary labels
// ---------------------------------------------------------------------------

const BOUNDARY_LABELS: Record<TraceabilityOutputBoundary, string> = {
	canonical: 'Canonical editable output',
	derived: 'Derived review artifact',
	execution_aid: 'Derived execution aid',
	non_canonical: 'Non-canonical review artifact',
	review_only: 'Review-only artifact',
};

export function getBoundaryLabel(boundary: TraceabilityOutputBoundary): string {
	return BOUNDARY_LABELS[boundary] ?? boundary;
}

export function getOutputKindLabel(kind: TraceabilityOutputKind): string {
	switch (kind) {
		case 'canonical_markdown':
			return 'Canonical Markdown';
		case 'validation_report':
			return 'Validation Report';
		case 'diagnostic_report':
			return 'Diagnostic Report';
		case 'html_artifact':
			return 'HTML Artifact';
		case 'agent_pack':
			return 'Agent Pack';
		case 'executive_json':
			return 'Executive JSON';
		case 'executive_markdown':
			return 'Executive Markdown';
		case 'executive_html':
			return 'Executive HTML';
		default:
			return kind;
	}
}

// ---------------------------------------------------------------------------
// Redaction helpers
// ---------------------------------------------------------------------------

function redactIfNeeded(
	value: string,
	options?: OutputTraceabilityOptions,
): string {
	if (options?.redactSecrets === false) return value;
	const redactOptions =
		options?.projectRoot !== undefined
			? { projectRoot: options.projectRoot }
			: undefined;
	return redactString(value, redactOptions);
}

function redactPath(path: string): string {
	if (!path) return path;
	// Reject unsafe traversal patterns
	if (path.includes('..')) {
		return '[path-traversal-redacted]';
	}
	return path;
}

// ---------------------------------------------------------------------------
// Portable path helpers
// ---------------------------------------------------------------------------

export function makePortablePath(
	path: string | undefined,
	projectRoot?: string,
): PortableSourcePath | undefined {
	if (!path) return undefined;
	const normalized = path.replace(/\\/g, '/');
	if (isAbsolute(normalized)) {
		if (projectRoot) {
			try {
				const rel = relative(projectRoot, normalized).replace(/\\/g, '/');
				if (!rel.startsWith('..') && !isAbsolute(rel)) {
					return { relativePath: rel, rootHint: 'project' };
				}
			} catch {
				// fall through to redaction
			}
		}
		// Absolute path that cannot be relativized: redact
		return { relativePath: '[absolute-path-redacted]', rootHint: 'project' };
	}
	return { relativePath: normalized, rootHint: 'project' };
}

export function renderPortablePath(
	portable: PortableSourcePath | undefined,
): string | undefined {
	if (!portable) return undefined;
	return redactPath(portable.relativePath);
}

// ---------------------------------------------------------------------------
// Mapping: SourceRecord -> TraceabilitySourceItem
// ---------------------------------------------------------------------------

export function toTraceabilitySourceItem(
	source: SourceRecord,
	options?: OutputTraceabilityOptions,
): TraceabilitySourceItem {
	const portable = makePortablePath(source.location.path, options?.projectRoot);
	return {
		confidence: source.confidence,
		lineReference:
			source.location.line !== undefined
				? String(source.location.line)
				: undefined,
		pointer: source.location.pointer,
		relatedClaimId: undefined,
		relatedDocumentCanonicalId: source.relatedDocumentCanonicalId,
		relatedPhaseId: source.relatedPhaseId,
		relatedRegisterItemId: source.relatedWorkspaceRecordId,
		relatedValidationFindingId: source.relatedValidationFindingId,
		relativeSourcePath: renderPortablePath(portable),
		reviewMarker: mapSourceStatusToReviewMarker(source.status),
		section: source.location.section,
		sourceId: redactIfNeeded(source.sourceId as string, options),
		sourceTimestamp:
			source.timestamp.createdAt ??
			source.timestamp.generatedAt ??
			source.timestamp.observedAt,
		sourceType: source.sourceType,
		status: source.status,
		title: redactIfNeeded(source.title, options),
	};
}

function mapSourceStatusToReviewMarker(
	status: SourceRecord['status'],
): TraceabilityReviewMarker {
	switch (status) {
		case 'confirmed':
			return 'approved';
		case 'requires_review':
			return 'required';
		case 'rejected':
			return 'rejected';
		case 'inferred':
			return 'required';
		case 'superseded':
			return 'blocked';
		default:
			return 'not_required';
	}
}

// ---------------------------------------------------------------------------
// Mapping: ClaimRecord -> TraceabilityClaimItem
// ---------------------------------------------------------------------------

export function toTraceabilityClaimItem(
	claim: ClaimRecord,
	options?: OutputTraceabilityOptions,
): TraceabilityClaimItem {
	return {
		claimId: claim.claimId,
		claimType: claim.claimType,
		confidence: claim.confidence,
		isGenerated: claim.isGenerated,
		isInferred: claim.isInferred,
		primarySourceId: claim.primarySourceId,
		relatedDocumentCanonicalId: claim.relatedDocumentCanonicalId,
		relatedPhaseId: claim.relatedPhaseId,
		relatedSectionId: claim.relatedSectionId,
		relatedSectionPath: claim.relatedSectionPath,
		reviewRequiredMarker:
			claim.reviewState === 'required' || claim.confidence === 'inferred',
		reviewState: claim.reviewState,
		shortSummary: redactIfNeeded(claim.summary, options),
		sourceCount: claim.sourceCount,
		status: claim.status,
	};
}

// ---------------------------------------------------------------------------
// Sorting (deterministic)
// ---------------------------------------------------------------------------

export function sortTraceabilitySources(
	sources: TraceabilitySourceItem[],
): TraceabilitySourceItem[] {
	return [...sources].sort((a, b) => {
		const typeOrderA = SOURCE_TYPE_ORDER[a.sourceType] ?? 999;
		const typeOrderB = SOURCE_TYPE_ORDER[b.sourceType] ?? 999;
		if (typeOrderA !== typeOrderB) return typeOrderA - typeOrderB;
		const statusOrderA = sourceStatusOrder(a.status);
		const statusOrderB = sourceStatusOrder(b.status);
		if (statusOrderA !== statusOrderB) return statusOrderA - statusOrderB;
		const confOrderA = SOURCE_CONFIDENCE_ORDER[a.confidence] ?? 999;
		const confOrderB = SOURCE_CONFIDENCE_ORDER[b.confidence] ?? 999;
		if (confOrderA !== confOrderB) return confOrderA - confOrderB;
		if (a.relatedPhaseId && b.relatedPhaseId) {
			if (a.relatedPhaseId !== b.relatedPhaseId)
				return a.relatedPhaseId.localeCompare(b.relatedPhaseId);
		}
		if (a.relatedDocumentCanonicalId && b.relatedDocumentCanonicalId) {
			if (a.relatedDocumentCanonicalId !== b.relatedDocumentCanonicalId)
				return a.relatedDocumentCanonicalId.localeCompare(
					b.relatedDocumentCanonicalId,
				);
		}
		if (a.sourceTimestamp && b.sourceTimestamp) {
			return a.sourceTimestamp.localeCompare(b.sourceTimestamp);
		}
		return a.sourceId.localeCompare(b.sourceId);
	});
}

function sourceStatusOrder(status: SourceRecord['status']): number {
	const map: Record<string, number> = {
		confirmed: 0,
		inferred: 2,
		proposed: 1,
		rejected: 6,
		requires_review: 3,
		superseded: 5,
		unknown: 4,
	};
	return map[status] ?? 999;
}

export function sortTraceabilityClaims(
	claims: TraceabilityClaimItem[],
): TraceabilityClaimItem[] {
	return [...claims].sort((a, b) => {
		const typeOrderA = CLAIM_TYPE_ORDER[a.claimType] ?? 999;
		const typeOrderB = CLAIM_TYPE_ORDER[b.claimType] ?? 999;
		if (typeOrderA !== typeOrderB) return typeOrderA - typeOrderB;
		const statusOrderA = CLAIM_STATUS_ORDER[a.status] ?? 999;
		const statusOrderB = CLAIM_STATUS_ORDER[b.status] ?? 999;
		if (statusOrderA !== statusOrderB) return statusOrderA - statusOrderB;
		const reviewOrderA = CLAIM_REVIEW_STATE_ORDER[a.reviewState] ?? 999;
		const reviewOrderB = CLAIM_REVIEW_STATE_ORDER[b.reviewState] ?? 999;
		if (reviewOrderA !== reviewOrderB) return reviewOrderA - reviewOrderB;
		const confOrderA = CLAIM_CONFIDENCE_ORDER[a.confidence] ?? 999;
		const confOrderB = CLAIM_CONFIDENCE_ORDER[b.confidence] ?? 999;
		if (confOrderA !== confOrderB) return confOrderA - confOrderB;
		if (a.relatedPhaseId && b.relatedPhaseId) {
			if (a.relatedPhaseId !== b.relatedPhaseId)
				return a.relatedPhaseId.localeCompare(b.relatedPhaseId);
		}
		if (a.relatedDocumentCanonicalId && b.relatedDocumentCanonicalId) {
			if (a.relatedDocumentCanonicalId !== b.relatedDocumentCanonicalId)
				return a.relatedDocumentCanonicalId.localeCompare(
					b.relatedDocumentCanonicalId,
				);
		}
		return a.claimId.localeCompare(b.claimId);
	});
}

// ---------------------------------------------------------------------------
// Register summary builder
// ---------------------------------------------------------------------------

export function buildTraceabilityRegisterSummary(
	registers: RegisterCollections | undefined,
): TraceabilityRegisterSummary | undefined {
	if (!registers) return undefined;
	const decisionCount = registers.decisions?.length ?? 0;
	const assumptionCount = registers.assumptions?.length ?? 0;
	const riskCount = registers.risks?.length ?? 0;
	const openQuestionCount = registers.openQuestions?.length ?? 0;
	const hypothesisCount = registers.hypotheses?.length ?? 0;
	const reviewRequiredCount =
		(registers.decisions?.filter((d) => d.reviewState === 'requires_review')
			.length ?? 0) +
		(registers.assumptions?.filter((a) => a.reviewState === 'requires_review')
			.length ?? 0) +
		(registers.risks?.filter((r) => r.reviewState === 'requires_review')
			.length ?? 0) +
		(registers.openQuestions?.filter((q) => q.reviewState === 'requires_review')
			.length ?? 0) +
		(registers.hypotheses?.filter((h) => h.reviewState === 'requires_review')
			.length ?? 0);
	const missingSourceCount =
		(registers.decisions?.filter((d) => d.sourceLinks.length === 0).length ??
			0) +
		(registers.assumptions?.filter((a) => a.sourceLinks.length === 0).length ??
			0);
	const blockingOpenQuestionCount =
		registers.openQuestions?.filter((q) => q.isBlocking && q.status === 'open')
			.length ?? 0;
	return {
		assumptionCount,
		blockingOpenQuestionCount,
		decisionCount,
		hypothesisCount,
		missingSourceCount,
		openQuestionCount,
		reviewRequiredCount,
		riskCount,
	};
}

// ---------------------------------------------------------------------------
// Markdown rendering helpers
// ---------------------------------------------------------------------------

function escapeCell(value: string): string {
	return value.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function renderConfidenceMarker(confidence: TraceabilityConfidence): string {
	switch (confidence) {
		case 'explicit':
			return '✓ explicit';
		case 'derived':
			return '↳ derived';
		case 'inferred':
			return '⚠ inferred';
		case 'unknown':
			return '? unknown';
		default:
			return confidence;
	}
}

function renderReviewMarker(marker: TraceabilityReviewMarker): string {
	switch (marker) {
		case 'not_required':
			return '';
		case 'required':
			return '🔍 requires review';
		case 'in_review':
			return '🔄 in review';
		case 'approved':
			return '✓ approved';
		case 'rejected':
			return '✗ rejected';
		case 'blocked':
			return '🚫 blocked';
		default:
			return marker;
	}
}

export function renderTraceabilitySourceListMarkdown(
	sources: TraceabilitySourceItem[],
): string {
	if (sources.length === 0) {
		return '> No sources recorded.\n';
	}

	const lines: string[] = [];
	lines.push(
		'| Source ID | Type | Status | Confidence | Title | Document | Phase | Review |',
	);
	lines.push(
		'| --------- | ---- | ------ | ---------- | ----- | -------- | ----- | ------ |',
	);

	for (const s of sources) {
		const id = escapeCell(s.sourceId);
		const type = escapeCell(s.sourceType);
		const status = escapeCell(s.status);
		const confidence = escapeCell(renderConfidenceMarker(s.confidence));
		const title = escapeCell(s.title);
		const doc = escapeCell(s.relatedDocumentCanonicalId ?? '-');
		const phase = escapeCell(s.relatedPhaseId ?? '-');
		const review = escapeCell(
			renderReviewMarker(s.reviewMarker ?? 'not_required'),
		);
		lines.push(
			`| ${id} | ${type} | ${status} | ${confidence} | ${title} | ${doc} | ${phase} | ${review} |`,
		);
	}

	lines.push('');
	return lines.join('\n');
}

export function renderTraceabilityClaimListMarkdown(
	claims: TraceabilityClaimItem[],
): string {
	if (claims.length === 0) {
		return '> No claims recorded.\n';
	}

	const lines: string[] = [];
	lines.push(
		'| Claim ID | Type | Status | Confidence | Review | Summary | Sources |',
	);
	lines.push(
		'| -------- | ---- | ------ | ---------- | ------ | ------- | ------- |',
	);

	for (const c of claims) {
		const id = escapeCell(c.claimId as string);
		const type = escapeCell(c.claimType);
		const status = escapeCell(c.status);
		const confidence = escapeCell(renderConfidenceMarker(c.confidence));
		const review = escapeCell(renderReviewMarker(c.reviewState));
		const summary = escapeCell(c.shortSummary);
		const sources = String(c.sourceCount);
		lines.push(
			`| ${id} | ${type} | ${status} | ${confidence} | ${review} | ${summary} | ${sources} |`,
		);
	}

	lines.push('');
	return lines.join('\n');
}

export function renderTraceabilitySummaryMarkdown(
	metadata: TraceabilityMetadata,
): string {
	const lines: string[] = [];
	lines.push('## Traceability Summary');
	lines.push('');
	lines.push(`- **Output Kind:** ${getOutputKindLabel(metadata.outputKind)}`);
	lines.push(`- **Boundary:** ${getBoundaryLabel(metadata.boundary)}`);
	lines.push(`- **Sources:** ${metadata.sourceCount}`);
	lines.push(`- **Claims:** ${metadata.claimCount}`);
	lines.push(`- **Review Required:** ${metadata.reviewRequiredCount}`);
	lines.push(`- **Inferred Claims:** ${metadata.inferredClaimCount}`);
	lines.push(`- **Unresolved Questions:** ${metadata.unresolvedQuestionCount}`);
	if (metadata.blockingOpenQuestionCount > 0) {
		lines.push(
			`- **Blocking Open Questions:** ${metadata.blockingOpenQuestionCount}`,
		);
	}
	lines.push(`- **Missing Sources:** ${metadata.missingSourceCount}`);
	if (metadata.registerSummary) {
		const rs = metadata.registerSummary;
		lines.push(`- **Decisions:** ${rs.decisionCount}`);
		lines.push(`- **Assumptions:** ${rs.assumptionCount}`);
		lines.push(`- **Risks:** ${rs.riskCount}`);
		lines.push(`- **Open Questions:** ${rs.openQuestionCount}`);
		lines.push(`- **Hypotheses:** ${rs.hypothesisCount}`);
	}
	lines.push('');
	return lines.join('\n');
}

export function renderTraceabilitySectionMarkdown(
	metadata: TraceabilityMetadata,
): string {
	const lines: string[] = [];

	lines.push(renderTraceabilitySummaryMarkdown(metadata));

	if (metadata.sourceReferences.length > 0) {
		lines.push('### Sources');
		lines.push('');
		lines.push(renderTraceabilitySourceListMarkdown(metadata.sourceReferences));
	}

	if (metadata.claimReferences.length > 0) {
		lines.push('### Claims');
		lines.push('');
		lines.push(renderTraceabilityClaimListMarkdown(metadata.claimReferences));
	}

	if (metadata.diagnostics.length > 0) {
		lines.push('### Diagnostics');
		lines.push('');
		for (const d of metadata.diagnostics) {
			lines.push(`- **${d.severity.toUpperCase()}** [${d.code}] ${d.message}`);
		}
		lines.push('');
	}

	return lines.join('\n');
}

export function renderMetadataHeaderAddon(
	metadata: TraceabilityMetadata,
): string {
	const lines: string[] = [];
	lines.push(`boundary: ${metadata.boundary}`);
	lines.push(`sourceCount: ${metadata.sourceCount}`);
	lines.push(`claimCount: ${metadata.claimCount}`);
	lines.push(`reviewRequiredCount: ${metadata.reviewRequiredCount}`);
	lines.push(`inferredClaimCount: ${metadata.inferredClaimCount}`);
	lines.push(`unresolvedQuestionCount: ${metadata.unresolvedQuestionCount}`);
	lines.push(
		`blockingOpenQuestionCount: ${metadata.blockingOpenQuestionCount}`,
	);
	lines.push(`missingSourceCount: ${metadata.missingSourceCount}`);
	if (metadata.generationRunId) {
		lines.push(`generationRunId: ${metadata.generationRunId}`);
	}
	if (metadata.validationRunId) {
		lines.push(`validationRunId: ${metadata.validationRunId}`);
	}
	if (metadata.artifactId) {
		lines.push(`artifactId: ${metadata.artifactId}`);
	}
	return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Main builder
// ---------------------------------------------------------------------------

export function buildTraceabilityResult(
	input: OutputTraceabilityInput,
	options?: OutputTraceabilityOptions,
): OutputTraceabilityResult {
	const generatedAt =
		options?.deterministicTimestamp ??
		input.generatedAt ??
		new Date().toISOString();

	const sources = sortTraceabilitySources(
		(input.sources ?? []).map((s) => toTraceabilitySourceItem(s, options)),
	);
	const claims = sortTraceabilityClaims(
		(input.claims ?? []).map((c) => toTraceabilityClaimItem(c, options)),
	);

	const reviewRequiredCount = claims.filter(
		(c) => c.reviewRequiredMarker,
	).length;
	const inferredClaimCount = claims.filter((c) => c.isInferred).length;
	const unresolvedQuestionCount = claims.filter(
		(c) => c.claimType === 'open_question' && c.status !== 'confirmed',
	).length;
	const blockingOpenQuestionCount = claims.filter(
		(c) =>
			c.claimType === 'open_question' &&
			(c.status === 'requires_review' || c.status === 'proposed'),
	).length;
	const missingSourceCount =
		claims.filter((c) => c.sourceCount === 0).length +
		sources.filter((s) => s.status === 'unknown').length;

	const registerSummary = buildTraceabilityRegisterSummary(input.registers);

	const metadata: TraceabilityMetadata = {
		artifactId: input.artifactId,
		blockingOpenQuestionCount,
		boundary: input.boundary,
		claimCount: claims.length,
		claimReferences: claims,
		diagnostics: input.diagnostics ?? [],
		documentCanonicalId: input.documentCanonicalId,
		generatedAt,
		generationRunId: input.generationRunId,
		inferredClaimCount,
		missingSourceCount,
		outputKind: input.outputKind,
		outputPath: input.outputPath,
		phaseId: input.phaseId,
		profileId: input.profileId,
		registerSummary,
		reviewRequiredCount,
		sourceCount: sources.length,
		sourceReferences: sources,
		unresolvedQuestionCount,
		validationRunId: input.validationRunId,
	};

	return {
		metadata,
		renderedJson: { metadata },
		renderedMarkdown: {
			metadataHeaderAddon: renderMetadataHeaderAddon(metadata),
			traceabilitySection: renderTraceabilitySectionMarkdown(metadata),
		},
	};
}
