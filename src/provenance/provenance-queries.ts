/** Step 8.1 — Provenance query APIs (read-only) */

import type {
	ClaimConfidence,
	ClaimRecord,
	ClaimSourceLink,
	ClaimSourceLinkType,
	ClaimStatus,
	ClaimType,
	ProvenanceGraph,
	ProvenanceSummary,
	SourceId,
	SourceRecord,
	SourceResolutionDiagnostic,
	SourceType,
} from './provenance-types.js';
import {
	CLAIM_CONFIDENCE_ORDER,
	CLAIM_STATUS_ORDER,
	CLAIM_TYPE_ORDER,
	LINK_TYPE_ORDER,
	SOURCE_TYPE_ORDER,
} from './provenance-types.js';

// ---------------------------------------------------------------------------
// Deterministic sort helpers
// ---------------------------------------------------------------------------

function compareSourceType(a: SourceType, b: SourceType): number {
	return (SOURCE_TYPE_ORDER[a] ?? 99) - (SOURCE_TYPE_ORDER[b] ?? 99);
}

function compareClaimType(a: ClaimType, b: ClaimType): number {
	return (CLAIM_TYPE_ORDER[a] ?? 99) - (CLAIM_TYPE_ORDER[b] ?? 99);
}

function compareClaimStatus(a: ClaimStatus, b: ClaimStatus): number {
	return (CLAIM_STATUS_ORDER[a] ?? 99) - (CLAIM_STATUS_ORDER[b] ?? 99);
}

function compareClaimConfidence(
	a: ClaimConfidence,
	b: ClaimConfidence,
): number {
	return (CLAIM_CONFIDENCE_ORDER[a] ?? 99) - (CLAIM_CONFIDENCE_ORDER[b] ?? 99);
}

function compareLinkType(
	a: ClaimSourceLinkType,
	b: ClaimSourceLinkType,
): number {
	return (LINK_TYPE_ORDER[a] ?? 99) - (LINK_TYPE_ORDER[b] ?? 99);
}

function sortSources(sources: SourceRecord[]): SourceRecord[] {
	return [...sources].sort((a, b) => {
		const typeCmp = compareSourceType(a.sourceType, b.sourceType);
		if (typeCmp !== 0) return typeCmp;
		const phaseCmp = (a.relatedPhaseId ?? '').localeCompare(
			b.relatedPhaseId ?? '',
		);
		if (phaseCmp !== 0) return phaseCmp;
		const docCmp = (a.relatedDocumentCanonicalId ?? '').localeCompare(
			b.relatedDocumentCanonicalId ?? '',
		);
		if (docCmp !== 0) return docCmp;
		const timeCmp = (a.timestamp.createdAt ?? '').localeCompare(
			b.timestamp.createdAt ?? '',
		);
		if (timeCmp !== 0) return timeCmp;
		return (a.sourceId as string).localeCompare(b.sourceId as string);
	});
}

function sortClaims(claims: ClaimRecord[]): ClaimRecord[] {
	return [...claims].sort((a, b) => {
		const docCmp = (a.relatedDocumentCanonicalId ?? '').localeCompare(
			b.relatedDocumentCanonicalId ?? '',
		);
		if (docCmp !== 0) return docCmp;
		const phaseCmp = (a.relatedPhaseId ?? '').localeCompare(
			b.relatedPhaseId ?? '',
		);
		if (phaseCmp !== 0) return phaseCmp;
		const typeCmp = compareClaimType(a.claimType, b.claimType);
		if (typeCmp !== 0) return typeCmp;
		const statusCmp = compareClaimStatus(a.status, b.status);
		if (statusCmp !== 0) return statusCmp;
		const confCmp = compareClaimConfidence(a.confidence, b.confidence);
		if (confCmp !== 0) return confCmp;
		return (a.claimId as string).localeCompare(b.claimId as string);
	});
}

function sortLinks(links: ClaimSourceLink[]): ClaimSourceLink[] {
	return [...links].sort((a, b) => {
		const claimCmp = (a.claimId as string).localeCompare(b.claimId as string);
		if (claimCmp !== 0) return claimCmp;
		const typeCmp = compareLinkType(a.linkType, b.linkType);
		if (typeCmp !== 0) return typeCmp;
		return (a.sourceId as string).localeCompare(b.sourceId as string);
	});
}

// ---------------------------------------------------------------------------
// Diagnostic helpers
// ---------------------------------------------------------------------------

function unknownIdDiag(id: string, idKind: string): SourceResolutionDiagnostic {
	return {
		code: `provenance_unknown_${idKind}_id`,
		message: `Unknown ${idKind} id: "${id}"`,
		recoveryHint: `Ensure the ${idKind} exists in the provenance graph.`,
		severity: 'warning',
	};
}

// ---------------------------------------------------------------------------
// Build provenance graph from collections
// ---------------------------------------------------------------------------

export function buildProvenanceGraph(
	sources: SourceRecord[],
	claims: ClaimRecord[],
	links?: ClaimSourceLink[] | undefined,
): ProvenanceGraph {
	const allLinks = links ?? [];
	const diagnostics: SourceResolutionDiagnostic[] = [];

	// Collect all links referenced by claims
	const claimLinks: ClaimSourceLink[] = [];
	for (const claim of claims) {
		for (const link of claim.sourceLinks) {
			claimLinks.push(link);
		}
	}

	const mergedLinks = [...allLinks, ...claimLinks];
	const dedupedLinks = deduplicateLinks(mergedLinks);

	return {
		claims: sortClaims(claims),
		diagnostics,
		links: sortLinks(dedupedLinks),
		sources: sortSources(sources),
	};
}

function deduplicateLinks(links: ClaimSourceLink[]): ClaimSourceLink[] {
	const seen = new Set<string>();
	const result: ClaimSourceLink[] = [];
	for (const link of links) {
		const key = `${link.claimId}::${link.sourceId}::${link.linkType}`;
		if (!seen.has(key)) {
			seen.add(key);
			result.push(link);
		}
	}
	return result;
}

// ---------------------------------------------------------------------------
// Source resolution in a graph
// ---------------------------------------------------------------------------

function findSourcesInGraph(
	graph: ProvenanceGraph,
	sourceIds: SourceId[],
): { sources: SourceRecord[]; diagnostics: SourceResolutionDiagnostic[] } {
	const diagnostics: SourceResolutionDiagnostic[] = [];
	const found: SourceRecord[] = [];
	const sourceMap = new Map<string, SourceRecord>();
	for (const s of graph.sources) {
		sourceMap.set(s.sourceId as string, s);
	}
	for (const id of sourceIds) {
		const source = sourceMap.get(id as string);
		if (source) {
			found.push(source);
		} else {
			diagnostics.push(unknownIdDiag(id as string, 'source'));
		}
	}
	return { diagnostics, sources: sortSources(found) };
}

// ---------------------------------------------------------------------------
// Query APIs
// ---------------------------------------------------------------------------

export interface ProvenanceQueryContext {
	graph: ProvenanceGraph;
}

export function resolveSourceById(
	context: ProvenanceQueryContext,
	sourceId: SourceId,
): { sources: SourceRecord[]; diagnostics: SourceResolutionDiagnostic[] } {
	return findSourcesInGraph(context.graph, [sourceId]);
}

export function resolveSourcesForClaim(
	context: ProvenanceQueryContext,
	claimIdText: string,
): {
	sources: SourceRecord[];
	links: ClaimSourceLink[];
	diagnostics: SourceResolutionDiagnostic[];
} {
	const diagnostics: SourceResolutionDiagnostic[] = [];
	const claim = context.graph.claims.find((c) => c.claimId === claimIdText);
	if (!claim) {
		diagnostics.push(unknownIdDiag(claimIdText, 'claim'));
		return { diagnostics, links: [], sources: [] };
	}

	const sourceIds = claim.sourceLinks.map((l) => l.sourceId) as SourceId[];
	const resolved = findSourcesInGraph(context.graph, sourceIds);
	diagnostics.push(...resolved.diagnostics);
	return {
		diagnostics,
		links: claim.sourceLinks,
		sources: resolved.sources,
	};
}

export function resolveClaimsForSource(
	context: ProvenanceQueryContext,
	sourceId: SourceId,
): {
	claims: ClaimRecord[];
	links: ClaimSourceLink[];
	diagnostics: SourceResolutionDiagnostic[];
} {
	const diagnostics: SourceResolutionDiagnostic[] = [];
	const source = context.graph.sources.find((s) => s.sourceId === sourceId);
	if (!source) {
		diagnostics.push(unknownIdDiag(sourceId as string, 'source'));
		return { claims: [], diagnostics, links: [] };
	}

	const links: ClaimSourceLink[] = [];
	const claimSet = new Set<string>();
	for (const link of context.graph.links) {
		if (link.sourceId === sourceId) {
			links.push(link);
			claimSet.add(link.claimId as string);
		}
	}

	const claims = context.graph.claims.filter((c) =>
		claimSet.has(c.claimId as string),
	);
	return {
		claims: sortClaims(claims),
		diagnostics,
		links: sortLinks(links),
	};
}

export function resolveSourcesForDocument(
	context: ProvenanceQueryContext,
	documentId: string,
): { sources: SourceRecord[]; diagnostics: SourceResolutionDiagnostic[] } {
	const diagnostics: SourceResolutionDiagnostic[] = [];
	const sources = context.graph.sources.filter(
		(s) => s.relatedDocumentCanonicalId === documentId,
	);
	if (sources.length === 0) {
		diagnostics.push({
			code: 'provenance_no_sources_for_document',
			message: `No sources found for document "${documentId}".`,
			recoveryHint: 'Attach sources to generated sections for this document.',
			relatedDocumentId: documentId,
			severity: 'info',
		});
	}
	return { diagnostics, sources: sortSources(sources) };
}

export function resolveClaimsForDocument(
	context: ProvenanceQueryContext,
	documentId: string,
): { claims: ClaimRecord[]; diagnostics: SourceResolutionDiagnostic[] } {
	const diagnostics: SourceResolutionDiagnostic[] = [];
	const claims = context.graph.claims.filter(
		(c) => c.relatedDocumentCanonicalId === documentId,
	);
	if (claims.length === 0) {
		diagnostics.push({
			code: 'provenance_no_claims_for_document',
			message: `No claims found for document "${documentId}".`,
			recoveryHint:
				'Generate claims when sections are produced for this document.',
			relatedDocumentId: documentId,
			severity: 'info',
		});
	}
	return { claims: sortClaims(claims), diagnostics };
}

export function resolveSourcesForGeneratedSection(
	context: ProvenanceQueryContext,
	documentId: string,
	sectionIdOrPath: string,
): {
	sources: SourceRecord[];
	claims: ClaimRecord[];
	diagnostics: SourceResolutionDiagnostic[];
} {
	const diagnostics: SourceResolutionDiagnostic[] = [];
	const claims = context.graph.claims.filter(
		(c) =>
			c.relatedDocumentCanonicalId === documentId &&
			(c.relatedSectionId === sectionIdOrPath ||
				c.relatedSectionPath === sectionIdOrPath),
	);
	const sourceIds = new Set<SourceId>();
	for (const claim of claims) {
		for (const link of claim.sourceLinks) {
			sourceIds.add(link.sourceId);
		}
	}
	const resolved = findSourcesInGraph(context.graph, [...sourceIds]);
	diagnostics.push(...resolved.diagnostics);

	if (claims.length === 0) {
		diagnostics.push({
			code: 'provenance_no_section_claims',
			message: `No claims found for section "${sectionIdOrPath}" in document "${documentId}".`,
			recoveryHint: 'Attach provenance to generated sections.',
			relatedDocumentId: documentId,
			severity: 'info',
		});
	}

	return {
		claims: sortClaims(claims),
		diagnostics,
		sources: resolved.sources,
	};
}

export function resolveProvenanceForArtifact(
	context: ProvenanceQueryContext,
	artifactId: string,
): {
	sources: SourceRecord[];
	claims: ClaimRecord[];
	diagnostics: SourceResolutionDiagnostic[];
} {
	const diagnostics: SourceResolutionDiagnostic[] = [];
	const sources = context.graph.sources.filter(
		(s) => s.relatedArtifactId === artifactId,
	);
	const claims = context.graph.claims.filter(
		(c) => c.relatedArtifactId === artifactId,
	);

	if (sources.length === 0 && claims.length === 0) {
		diagnostics.push({
			code: 'provenance_no_provenance_for_artifact',
			message: `No provenance found for artifact "${artifactId}".`,
			recoveryHint: 'Link sources and claims to this artifact.',
			relatedSourceId: undefined,
			severity: 'info',
		});
	}

	return {
		claims: sortClaims(claims),
		diagnostics,
		sources: sortSources(sources),
	};
}

// ---------------------------------------------------------------------------
// Provenance summary
// ---------------------------------------------------------------------------

export function summarizeProvenance(graph: ProvenanceGraph): ProvenanceSummary {
	const sourceCountByType: Partial<Record<SourceType, number>> = {};
	const claimCountByType: Partial<Record<ClaimType, number>> = {};
	const claimCountByStatus: Partial<Record<ClaimStatus, number>> = {};
	const claimCountByConfidence: Partial<Record<ClaimConfidence, number>> = {};

	for (const s of graph.sources) {
		sourceCountByType[s.sourceType] =
			(sourceCountByType[s.sourceType] ?? 0) + 1;
	}

	let reviewRequiredClaimCount = 0;
	let missingSourceClaimCount = 0;
	let unsupportedSourceCount = 0;
	const docMissingMap = new Map<string, number>();

	for (const claim of graph.claims) {
		claimCountByType[claim.claimType] =
			(claimCountByType[claim.claimType] ?? 0) + 1;
		claimCountByStatus[claim.status] =
			(claimCountByStatus[claim.status] ?? 0) + 1;
		claimCountByConfidence[claim.confidence] =
			(claimCountByConfidence[claim.confidence] ?? 0) + 1;

		if (claim.reviewState === 'required' || claim.reviewState === 'in_review') {
			reviewRequiredClaimCount += 1;
		}

		if (claim.sourceCount === 0) {
			missingSourceClaimCount += 1;
			const docId = claim.relatedDocumentCanonicalId ?? '__unlinked__';
			docMissingMap.set(docId, (docMissingMap.get(docId) ?? 0) + 1);
		}
	}

	for (const source of graph.sources) {
		if (source.status === 'unknown' || source.confidence === 'unknown') {
			unsupportedSourceCount += 1;
		}
	}

	const topDocumentsMissingSources = [...docMissingMap.entries()]
		.sort((a, b) => b[1] - a[1])
		.slice(0, 10)
		.map(([documentId, missingCount]) => ({ documentId, missingCount }));

	const diagnostics: SourceResolutionDiagnostic[] = [];

	return {
		claimCountByConfidence,
		claimCountByStatus,
		claimCountByType,
		diagnostics,
		missingSourceClaimCount,
		reviewRequiredClaimCount,
		sourceCountByType,
		topDocumentsMissingSources,
		unsupportedSourceCount,
	};
}
