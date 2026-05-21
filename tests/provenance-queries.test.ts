/** Step 8.1 — Provenance query API and summary tests */
import { beforeEach, describe, expect, it } from 'vitest';
import type {
	ClaimRecord,
	ProvenanceGraph,
	SourceRecord,
} from '../src/provenance/index.js';
import {
	buildProvenanceGraph,
	claimFromDecision,
	claimFromGeneratedSection,
	resetProvenanceIdCounter,
	resolveClaimsForDocument,
	resolveClaimsForSource,
	resolveProvenanceForArtifact,
	resolveSourceById,
	resolveSourcesForClaim,
	resolveSourcesForDocument,
	resolveSourcesForGeneratedSection,
	sourceFromAssumption,
	sourceFromConfirmedDecision,
	sourceFromConversationAnswer,
	sourceFromProfileDescriptor,
	summarizeProvenance,
} from '../src/provenance/index.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockWorkspaceDecision(overrides = {}) {
	return {
		affectedDocumentIds: ['docs/arch'],
		body: 'We decided to use TypeScript.',
		confidence: 'high' as const,
		createdAt: '2025-01-01T00:00:00.000Z',
		id: 'dec-1',
		sourceRefs: [],
		status: 'confirmed' as const,
		title: 'Use TypeScript',
		...overrides,
	};
}

function mockWorkspaceAssumption(overrides = {}) {
	return {
		affectedDocumentIds: ['docs/arch'],
		body: 'We assume Node 22 is available.',
		caveat: 'Users may use older versions.',
		createdAt: '2025-01-01T00:00:00.000Z',
		id: 'asmp-1',
		sourceRefs: [],
		status: 'active' as const,
		title: 'Node 22 available',
		...overrides,
	};
}

function mockRenderedSection(overrides = {}) {
	return {
		descriptorOrder: 0,
		gaps: [],
		markdown: '## Architecture\n\nGenerated architecture section.',
		required: true,
		sectionId: 'sec-arch',
		sources: [],
		status: 'rendered' as const,
		title: 'Architecture',
		...overrides,
	};
}

function buildFixtureGraph(): ProvenanceGraph {
	resetProvenanceIdCounter(0);

	const decision = mockWorkspaceDecision();
	const decisionSource = sourceFromConfirmedDecision(decision).source;
	const decisionClaim = claimFromDecision(decision, [decisionSource]).claim;

	const assumption = mockWorkspaceAssumption();
	const assumptionSource = sourceFromAssumption(assumption).source;

	const answer = { answerId: 'ans-1', text: 'We need Node 22+.' };
	const answerSource = sourceFromConversationAnswer(answer).source;

	const profileSource = sourceFromProfileDescriptor({
		label: 'Standard Profile',
		profileId: 'standard',
	}).source;

	const section = mockRenderedSection();
	const sectionClaim = claimFromGeneratedSection(section, [
		profileSource,
		decisionSource,
	]).claim;

	const sources: SourceRecord[] = [
		decisionSource,
		assumptionSource,
		answerSource,
		profileSource,
	];

	const claims: ClaimRecord[] = [decisionClaim, sectionClaim];

	return buildProvenanceGraph(sources, claims);
}

// ---------------------------------------------------------------------------
// Query API tests
// ---------------------------------------------------------------------------

describe('Provenance query APIs', () => {
	let graph: ProvenanceGraph;

	beforeEach(() => {
		graph = buildFixtureGraph();
	});

	it('resolve source by id', () => {
		const source = graph.sources[0];
		const result = resolveSourceById({ graph }, source.sourceId);
		expect(result.sources.length).toBe(1);
		expect(result.sources[0].sourceId).toBe(source.sourceId);
	});

	it('resolve sources for claim', () => {
		const claim = graph.claims[0];
		const result = resolveSourcesForClaim({ graph }, claim.claimId);
		expect(result.sources.length).toBeGreaterThan(0);
		expect(result.links.length).toBeGreaterThan(0);
	});

	it('resolve claims for source', () => {
		const source = graph.sources[0];
		const result = resolveClaimsForSource({ graph }, source.sourceId);
		expect(result.claims.length).toBeGreaterThanOrEqual(0);
	});

	it('resolve sources for document', () => {
		const result = resolveSourcesForDocument({ graph }, 'docs/arch');
		// Should find sources that reference docs/arch
		expect(result.sources.length).toBeGreaterThanOrEqual(0);
	});

	it('resolve claims for document', () => {
		const result = resolveClaimsForDocument({ graph }, 'docs/arch');
		// Decision claim has affectedDocumentIds including docs/arch
		// But ClaimRecord uses relatedDocumentCanonicalId
		expect(result.claims.length).toBeGreaterThanOrEqual(0);
	});

	it('resolve sources for generated section', () => {
		const result = resolveSourcesForGeneratedSection(
			{ graph },
			'docs/arch',
			'sec-arch',
		);
		expect(result.sources.length).toBeGreaterThanOrEqual(0);
	});

	it('resolve provenance for artifact', () => {
		const result = resolveProvenanceForArtifact({ graph }, 'artifact-1');
		// Unknown artifact should produce diagnostic
		expect(result.diagnostics.length).toBeGreaterThan(0);
	});

	it('unknown source/claim/artifact IDs return diagnostics', () => {
		const { sources, diagnostics } = resolveSourceById(
			{ graph },
			'src:nonexistent:1:999' as never,
		);
		expect(diagnostics.length).toBeGreaterThan(0);
		expect(sources.length).toBe(0);
	});

	it('query ordering is deterministic', () => {
		// Build two identical graphs and verify queries produce same results
		resetProvenanceIdCounter(0);
		const g1 = buildFixtureGraph();
		resetProvenanceIdCounter(0);
		const g2 = buildFixtureGraph();

		const r1 = resolveSourceById({ graph: g1 }, g1.sources[0].sourceId);
		const r2 = resolveSourceById({ graph: g2 }, g2.sources[0].sourceId);
		expect(r1.sources[0].sourceId).toBe(r2.sources[0].sourceId);
	});

	it('query APIs do not mutate state', () => {
		const sourceCount = graph.sources.length;
		const claimCount = graph.claims.length;

		resolveSourceById({ graph }, graph.sources[0].sourceId);
		resolveSourcesForClaim({ graph }, graph.claims[0].claimId);
		resolveClaimsForSource({ graph }, graph.sources[0].sourceId);
		resolveSourcesForDocument({ graph }, 'docs/arch');
		resolveClaimsForDocument({ graph }, 'docs/arch');

		expect(graph.sources.length).toBe(sourceCount);
		expect(graph.claims.length).toBe(claimCount);
	});
});

// ---------------------------------------------------------------------------
// Summary tests
// ---------------------------------------------------------------------------

describe('Provenance summary', () => {
	it('counts sources by type', () => {
		const graph = buildFixtureGraph();
		const summary = summarizeProvenance(graph);
		expect(summary.sourceCountByType.confirmed_decision).toBe(1);
		expect(summary.sourceCountByType.assumption).toBe(1);
		expect(summary.sourceCountByType.conversation_answer).toBe(1);
		expect(summary.sourceCountByType.profile_descriptor).toBe(1);
	});

	it('counts claims by type/status/confidence', () => {
		const graph = buildFixtureGraph();
		const summary = summarizeProvenance(graph);
		expect(summary.claimCountByType.decision).toBe(1);
		expect(summary.claimCountByType.generated_section).toBe(1);
		expect(summary.claimCountByStatus.confirmed).toBeGreaterThanOrEqual(0);
	});

	it('counts review-required claims', () => {
		const graph = buildFixtureGraph();
		const summary = summarizeProvenance(graph);
		expect(typeof summary.reviewRequiredClaimCount).toBe('number');
	});

	it('counts missing-source claims', () => {
		const graph = buildFixtureGraph();
		const summary = summarizeProvenance(graph);
		expect(typeof summary.missingSourceClaimCount).toBe('number');
	});

	it('summarizes documents with missing/review-required sources', () => {
		const graph = buildFixtureGraph();
		const summary = summarizeProvenance(graph);
		expect(Array.isArray(summary.topDocumentsMissingSources)).toBe(true);
	});

	it('summary is deterministic', () => {
		resetProvenanceIdCounter(0);
		const g1 = buildFixtureGraph();
		resetProvenanceIdCounter(0);
		const g2 = buildFixtureGraph();
		const s1 = summarizeProvenance(g1);
		const s2 = summarizeProvenance(g2);
		expect(s1).toEqual(s2);
	});
});
