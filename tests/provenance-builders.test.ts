/** Step 8.1 — Provenance builder tests */
import { beforeEach, describe, expect, it } from 'vitest';
import {
	claimFromAssumption,
	claimFromDecision,
	claimFromExecutiveItemDraft,
	claimFromGeneratedSection,
	claimFromOpenQuestion,
	claimFromRisk,
	claimFromValidationFinding,
	resetProvenanceIdCounter,
	sourceFromAssumption,
	sourceFromConfirmedDecision,
	sourceFromConversationAnswer,
	sourceFromExternalReference,
	sourceFromManualNote,
	sourceFromProfileDescriptor,
	sourceFromRepositoryScan,
	sourceFromValidationFinding,
} from '../src/provenance/index.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockWorkspaceDecision(overrides = {}) {
	return {
		affectedDocumentIds: [],
		body: 'We decided to use TypeScript.',
		confidence: 'high' as const,
		createdAt: '2025-01-01T00:00:00.000Z',
		id: 'dec-1',
		sourceRefs: [],
		status: 'confirmed' as const,
		title: 'Use TypeScript',
		updatedAt: '2025-01-02T00:00:00.000Z',
		...overrides,
	};
}

function mockWorkspaceAssumption(overrides = {}) {
	return {
		affectedDocumentIds: [],
		body: 'We assume Node 22 is available.',
		caveat: 'Users may use older versions.',
		createdAt: '2025-01-01T00:00:00.000Z',
		id: 'asmp-1',
		sourceRefs: [],
		status: 'active' as const,
		title: 'Node 22 available',
		updatedAt: '2025-01-02T00:00:00.000Z',
		...overrides,
	};
}

function mockWorkspaceRisk(overrides = {}) {
	return {
		affectedDocumentIds: [],
		body: 'Dependency breaking changes could delay release.',
		createdAt: '2025-01-01T00:00:00.000Z',
		id: 'risk-1',
		rationale: 'External dependencies are uncontrolled.',
		severity: 'high' as const,
		sourceRefs: [],
		status: 'identified' as const,
		title: 'Dependency breaking changes',
		updatedAt: '2025-01-02T00:00:00.000Z',
		...overrides,
	};
}

function mockWorkspaceOpenQuestion(overrides = {}) {
	return {
		affectedDocumentIds: [],
		body: 'Which CSS framework should we use?',
		createdAt: '2025-01-01T00:00:00.000Z',
		id: 'q-1',
		question: 'Which CSS framework?',
		sourceRefs: [],
		status: 'open' as const,
		updatedAt: '2025-01-02T00:00:00.000Z',
		...overrides,
	};
}

function mockRenderedSection(overrides = {}) {
	return {
		descriptorOrder: 0,
		gaps: [],
		markdown:
			'## Architecture\n\nThis is generated content about architecture.',
		required: true,
		sectionId: 'sec-architecture',
		sources: [],
		status: 'rendered' as const,
		title: 'Architecture',
		...overrides,
	};
}

function mockValidationFinding(overrides = {}) {
	return {
		code: 'workspace_missing',
		id: 'finding-1',
		location: {},
		message: 'Workspace is missing.',
		order: 0,
		severity: 'warning' as const,
		source: { kind: 'workspace_state' as const },
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// Source builder tests
// ---------------------------------------------------------------------------

describe('Source builders', () => {
	beforeEach(() => {
		resetProvenanceIdCounter(0);
	});

	it('builds source from conversation answer', () => {
		const answer = {
			answerId: 'ans-1',
			questionId: 'q-1',
			sessionId: 'sess-1',
			text: 'The project should use TypeScript.',
		};
		const result = sourceFromConversationAnswer(answer);
		expect(result.source.sourceType).toBe('conversation_answer');
		expect(result.source.status).toBe('confirmed');
		expect(result.source.confidence).toBe('explicit');
		expect(result.source.title).toContain('TypeScript');
		expect(result.source.metadata.answerId).toBe('ans-1');
	});

	it('uses portable relative state paths for conversation answer sources', () => {
		const result = sourceFromConversationAnswer(
			{
				answerId: 'ans-1',
				sessionId: 'sess-1',
				text: 'The project should use TypeScript.',
			},
			{ projectRoot: '/tmp/logos-project' },
		);

		expect(result.source.location.path).toBe('.logos/workspace.json');
		expect(result.source.location.path).not.toContain('/tmp/logos-project');
	});

	it('builds source from confirmed decision', () => {
		const decision = mockWorkspaceDecision();
		const { source } = sourceFromConfirmedDecision(decision);
		expect(source.sourceType).toBe('confirmed_decision');
		expect(source.status).toBe('confirmed');
		expect(source.confidence).toBe('explicit');
		expect(source.title).toBe('Use TypeScript');
		expect(source.relatedWorkspaceRecordId).toBe('dec-1');
	});

	it('uses portable relative state paths for decision and assumption sources', () => {
		const decision = mockWorkspaceDecision();
		const assumption = mockWorkspaceAssumption();
		const context = { projectRoot: '/tmp/logos-project' };

		const decisionSource = sourceFromConfirmedDecision(
			decision,
			context,
		).source;
		const assumptionSource = sourceFromAssumption(assumption, context).source;

		expect(decisionSource.location.path).toBe('.logos/workspace.json');
		expect(assumptionSource.location.path).toBe('.logos/workspace.json');
	});

	it('builds source from assumption', () => {
		const assumption = mockWorkspaceAssumption();
		const { source } = sourceFromAssumption(assumption);
		expect(source.sourceType).toBe('assumption');
		expect(source.status).toBe('confirmed');
		expect(source.confidence).toBe('explicit');
		expect(source.title).toBe('Node 22 available');
	});

	it('builds source from profile descriptor', () => {
		const { source } = sourceFromProfileDescriptor({
			descriptorPath: 'profiles/standard/docs.yml',
			label: 'Standard Profile',
			profileId: 'standard',
		});
		expect(source.sourceType).toBe('profile_descriptor');
		expect(source.confidence).toBe('explicit');
		expect(source.title).toBe('Standard Profile');
	});

	it('relativizes absolute descriptor paths when project root is known', () => {
		const { source } = sourceFromProfileDescriptor(
			{
				descriptorPath: '/tmp/logos-project/profiles/standard/docs.yml',
				label: 'Standard Profile',
				profileId: 'standard',
			},
			{ projectRoot: '/tmp/logos-project' },
		);

		expect(source.location.path).toBe('profiles/standard/docs.yml');
		expect(source.metadata.descriptorPath).toBe('profiles/standard/docs.yml');
	});

	it('builds source from validation finding', () => {
		const finding = mockValidationFinding();
		const { source } = sourceFromValidationFinding(finding);
		expect(source.sourceType).toBe('validation_finding');
		expect(source.confidence).toBe('explicit');
		expect(source.title).toContain('Workspace is missing');
	});

	it('builds source from manual note', () => {
		const note = {
			body: 'Important decisions...',
			noteId: 'note-1',
			title: 'Meeting notes',
		};
		const { source } = sourceFromManualNote(note);
		expect(source.sourceType).toBe('manual_note');
		expect(source.status).toBe('confirmed');
		expect(source.title).toBe('Meeting notes');
	});

	it('builds source reference shape for repository scan without scanning files', () => {
		const { source, diagnostics } = sourceFromRepositoryScan({
			description: 'Scanned for package.json, tsconfig.json.',
			label: 'Repository scan placeholder',
		});
		expect(source.sourceType).toBe('repository_scan');
		expect(source.status).toBe('inferred');
		expect(diagnostics.length).toBeGreaterThan(0);
		expect(diagnostics[0].code).toContain('not_implemented');
	});

	it('builds source from external reference without fetching it', () => {
		const { source } = sourceFromExternalReference({
			description: 'An external specification.',
			label: 'External Reference',
			uri: 'https://example.com/reference',
		});
		expect(source.sourceType).toBe('external_reference');
		expect(source.externalUri).toBe('https://example.com/reference');
		// Should not have fetched anything
	});

	it('missing required source fields produce diagnostics', () => {
		const answer = { answerId: '', sessionId: 'sess-1' };
		const { diagnostics } = sourceFromConversationAnswer(answer);
		expect(diagnostics.length).toBeGreaterThan(0);
	});
});

// ---------------------------------------------------------------------------
// Claim builder tests
// ---------------------------------------------------------------------------

describe('Claim builders', () => {
	beforeEach(() => {
		resetProvenanceIdCounter(100);
	});

	it('builds claim from confirmed decision with explicit confidence', () => {
		const decision = mockWorkspaceDecision();
		const { source } = sourceFromConfirmedDecision(decision);
		const { claim } = claimFromDecision(decision, [source]);
		expect(claim.claimType).toBe('decision');
		expect(claim.confidence).toBe('explicit');
		expect(claim.status).toBe('confirmed');
		expect(claim.sourceCount).toBe(1);
	});

	it('builds claim from assumption with assumption type/status', () => {
		const assumption = mockWorkspaceAssumption();
		const { source } = sourceFromAssumption(assumption);
		const { claim } = claimFromAssumption(assumption, [source]);
		expect(claim.claimType).toBe('assumption');
		expect(claim.isInferred).toBe(true);
		expect(claim.reviewState).toBe('required');
	});

	it('builds claim from risk', () => {
		const risk = mockWorkspaceRisk();
		const { source } = sourceFromConfirmedDecision(mockWorkspaceDecision());
		const { claim } = claimFromRisk(risk, [source]);
		expect(claim.claimType).toBe('risk');
		expect(claim.status).toBe('proposed');
	});

	it('builds claim from open question', () => {
		const openQ = mockWorkspaceOpenQuestion();
		const { source } = sourceFromConversationAnswer({
			answerId: 'ans-1',
			text: 'Need to decide on CSS framework.',
		});
		const { claim } = claimFromOpenQuestion(openQ, [source]);
		expect(claim.claimType).toBe('open_question');
		expect(claim.isInferred).toBe(true);
	});

	it('builds generated section claim with sources', () => {
		const section = mockRenderedSection();
		const { source } = sourceFromProfileDescriptor({
			label: 'Standard Profile',
			profileId: 'standard',
		});
		const { claim } = claimFromGeneratedSection(section, [source]);
		expect(claim.claimType).toBe('generated_section');
		expect(claim.isGenerated).toBe(true);
		expect(claim.sourceCount).toBe(1);
	});

	it('generated section without sufficient source becomes requires_review', () => {
		const section = mockRenderedSection({
			sources: [],
			status: 'incomplete',
		});
		const { claim } = claimFromGeneratedSection(section, []);
		expect(claim.status).toBe('requires_review');
		expect(claim.reviewState).toBe('required');
		expect(claim.diagnostics.length).toBeGreaterThan(0);
	});

	it('validation finding can become validation claim/source', () => {
		const finding = mockValidationFinding();
		const { source } = sourceFromValidationFinding(finding);
		const { claim } = claimFromValidationFinding(finding, [source]);
		expect(claim.claimType).toBe('validation_claim');
		expect(claim.confidence).toBe('explicit');
		expect(claim.status).toBe('confirmed');
	});

	it('executive item draft claim can link to normative sources', () => {
		const item = {
			body: 'Build the MVP with core features.',
			itemId: 'exec-item-1',
			itemTitle: 'Build MVP',
			sourceDocumentIds: ['docs/architecture'],
		};
		const { source } = sourceFromProfileDescriptor({
			label: 'Standard Profile',
			profileId: 'standard',
		});
		const { claim } = claimFromExecutiveItemDraft(item, [source]);
		expect(claim.claimType).toBe('executive_item');
		expect(claim.isInferred).toBe(true);
		expect(claim.reviewState).toBe('required');
		expect(claim.status).toBe('requires_review');
		// Does NOT compile Executive Axis
		expect(claim.claimType).not.toBe('fact');
	});

	it('inferred content is not confirmed', () => {
		const assumption = mockWorkspaceAssumption();
		const { source } = sourceFromAssumption(assumption);
		const { claim } = claimFromAssumption(assumption, [source]);
		expect(claim.status).not.toBe('confirmed');
		expect(claim.isInferred).toBe(true);
		expect(claim.reviewState).toBe('required');
	});
});
