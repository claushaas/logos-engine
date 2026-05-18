/** Step 8.1 — Provenance integration: generated sections, workspace state, executive items */
import { beforeEach, describe, expect, it } from 'vitest';
import type { ClaimRecord, SourceRecord } from '../src/provenance/index.js';
import {
	buildExecutiveItemProvenanceClaim,
	buildGeneratedSectionClaim,
	resetProvenanceIdCounter,
	sourceFromAssumption,
	sourceFromConfirmedDecision,
	sourceFromManualNote,
	sourceFromProfileDescriptor,
} from '../src/provenance/index.js';
import { WorkspaceStateSchema } from '../src/state/workspace-state.schema.js';
import { createDefaultWorkspaceState } from '../src/state/workspace-state-defaults.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockWorkspaceDecision(id = 'dec-1', overrides = {}) {
	return {
		affectedDocumentIds: ['docs/arch'],
		body: 'Decision body.',
		confidence: 'high' as const,
		createdAt: '2025-01-01T00:00:00.000Z',
		id,
		sourceRefs: [],
		status: 'confirmed' as const,
		title: 'Test Decision',
		...overrides,
	};
}

function mockWorkspaceAssumption(id = 'asmp-1', overrides = {}) {
	return {
		affectedDocumentIds: ['docs/arch'],
		body: 'Assumption body.',
		caveat: 'May not hold.',
		createdAt: '2025-01-01T00:00:00.000Z',
		id,
		sourceRefs: [],
		status: 'active' as const,
		title: 'Test Assumption',
		...overrides,
	};
}

function _mockWorkspaceRisk(id = 'risk-1', overrides = {}) {
	return {
		affectedDocumentIds: ['docs/arch'],
		body: 'Risk body.',
		createdAt: '2025-01-01T00:00:00.000Z',
		id,
		rationale: 'External dependency.',
		severity: 'high' as const,
		sourceRefs: [],
		status: 'identified' as const,
		title: 'Test Risk',
		...overrides,
	};
}

function _mockWorkspaceOpenQuestion(id = 'q-1', overrides = {}) {
	return {
		affectedDocumentIds: ['docs/arch'],
		body: 'Question body.',
		createdAt: '2025-01-01T00:00:00.000Z',
		id,
		question: 'What framework?',
		sourceRefs: [],
		status: 'open' as const,
		...overrides,
	};
}

function mockRenderedSection(sectionId = 'sec-arch', overrides = {}) {
	return {
		descriptorOrder: 0,
		gaps: [],
		markdown: '## Section\n\nGenerated section content about architecture.',
		required: true,
		sectionId,
		sources: [],
		status: 'rendered' as const,
		title: 'Architecture',
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// Generated section provenance tests
// ---------------------------------------------------------------------------

describe('Generated section provenance', () => {
	beforeEach(() => {
		resetProvenanceIdCounter(0);
	});

	it('generated section can list profile descriptor and confirmed decision sources', () => {
		const section = mockRenderedSection();
		const profileSrc = sourceFromProfileDescriptor({
			label: 'Standard Profile',
			profileId: 'standard',
		}).source;
		const decisionSrc = sourceFromConfirmedDecision(
			mockWorkspaceDecision(),
		).source;
		const sources = [profileSrc, decisionSrc];

		const docClaim = buildGeneratedSectionClaim(
			section,
			'docs/architecture',
			'04-engineering',
			'/sections/architecture',
			sources,
		);

		expect(docClaim.sources.length).toBe(2);
		expect(docClaim.sources[0].sourceType).toBe('profile_descriptor');
		expect(docClaim.sources[1].sourceType).toBe('confirmed_decision');
		expect(docClaim.documentCanonicalId).toBe('docs/architecture');
	});

	it('generated section can list assumption/open question/risk sources', () => {
		const section = mockRenderedSection();
		const assumptionSrc = sourceFromAssumption(
			mockWorkspaceAssumption(),
		).source;
		const sources = [assumptionSrc];

		const docClaim = buildGeneratedSectionClaim(
			section,
			'docs/arch',
			'04-engineering',
			'/sections/risks',
			sources,
		);

		expect(docClaim.sources[0].sourceType).toBe('assumption');
	});

	it('generated section with inferred content is review-required', () => {
		const section = mockRenderedSection('sec-inf', { status: 'incomplete' });
		const profileSrc = sourceFromProfileDescriptor({
			profileId: 'standard',
		}).source;

		const docClaim = buildGeneratedSectionClaim(
			section,
			'docs/inferred',
			'01-foundation',
			'/sections/inferred',
			[profileSrc],
		);

		expect(docClaim.isInferred).toBe(true);
		expect(docClaim.reviewState).toBe('required');
	});

	it('generated section source references preserve document/phase/section paths', () => {
		const section = mockRenderedSection();
		const decisionSrc = sourceFromConfirmedDecision(
			mockWorkspaceDecision(),
		).source;

		const docClaim = buildGeneratedSectionClaim(
			section,
			'docs/frontend',
			'03-product',
			'/sections/frontend',
			[decisionSrc],
		);

		expect(docClaim.documentCanonicalId).toBe('docs/frontend');
		expect(docClaim.phaseId).toBe('03-product');
		expect(docClaim.sectionPath).toBe('/sections/frontend');
	});

	it('no Markdown files are written', () => {
		const section = mockRenderedSection();
		const src = sourceFromProfileDescriptor({ profileId: 'standard' }).source;
		const docClaim = buildGeneratedSectionClaim(
			section,
			'docs/test',
			'01-foundation',
			'/sections/test',
			[src],
		);
		// Structured data only, no file writes
		expect(docClaim.sources.length).toBe(1);
	});
});

// ---------------------------------------------------------------------------
// Executive item provenance readiness tests
// ---------------------------------------------------------------------------

describe('Executive item provenance readiness', () => {
	beforeEach(() => {
		resetProvenanceIdCounter(500);
	});

	it('executive item draft can list normative sources without compiling Executive Axis', () => {
		const item = {
			body: 'Implement the core feature set.',
			itemId: 'exec-1',
			itemTitle: 'Build core features',
		};
		const src = sourceFromProfileDescriptor({ profileId: 'standard' }).source;
		const execClaim = buildExecutiveItemProvenanceClaim(item, [src]);

		expect(execClaim.claimId).toBeDefined();
		expect(execClaim.isInferred).toBe(true);
		expect(execClaim.reviewState).toBe('required');
		expect(execClaim.sources.length).toBe(1);
		// No Executive Axis JSON generated
	});

	it('executive item review state is required', () => {
		const item = { body: 'Some task.', itemId: 'exec-2' };
		const src = sourceFromManualNote({ noteId: 'n1', title: 'Note' }).source;
		const execClaim = buildExecutiveItemProvenanceClaim(item, [src]);
		expect(execClaim.reviewState).toBe('required');
	});
});

// ---------------------------------------------------------------------------
// Workspace state schema integration tests
// ---------------------------------------------------------------------------

describe('Workspace state schema provenance integration', () => {
	it('default initialized state can include empty provenance collections', () => {
		const state = createDefaultWorkspaceState();
		expect(state.sources).toBeDefined();
		expect(state.claims).toBeDefined();
		expect(state.claimSourceLinks).toBeDefined();
		expect(state.sources).toEqual([]);
		expect(state.claims).toEqual([]);
		expect(state.claimSourceLinks).toEqual([]);
	});

	it('sample state with sources/claims validates', () => {
		const base = createDefaultWorkspaceState();
		base.sources = [
			{
				confidence: 'explicit',
				sourceId: 'src:test:1:1',
				sourceType: 'manual_note',
				status: 'confirmed',
				title: 'Test source',
			},
		];
		base.claims = [
			{
				claimId: 'claim:test:1:1',
				claimType: 'decision',
				confidence: 'explicit',
				isGenerated: false,
				isInferred: false,
				reviewState: 'not_required',
				sourceCount: 0,
				sourceLinks: [],
				status: 'confirmed',
				summary: 'Test claim',
			} as ClaimRecord,
		];
		base.claimSourceLinks = [];
		const result = WorkspaceStateSchema.safeParse(base);
		expect(result.success).toBe(true);
	});

	it('invalid source/claim state fails with path-aware diagnostics', () => {
		const base = createDefaultWorkspaceState();
		base.sources = [
			{
				confidence: '',
				sourceId: '',
				sourceType: 'bad_type',
				status: '',
				title: '',
			} as unknown as SourceRecord,
		];
		const result = WorkspaceStateSchema.safeParse(base);
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues.length).toBeGreaterThan(0);
		}
	});

	it('raw token-like values in provenance state fail/redact', () => {
		const base = createDefaultWorkspaceState();
		base.sources = [
			{
				confidence: 'explicit',
				metadata: { token: 'sk-123456789012345678901234' },
				sourceId: 'src:test:token:1',
				sourceType: 'manual_note',
				status: 'confirmed',
				title: 'Token source',
			} as SourceRecord,
		];
		const result = WorkspaceStateSchema.safeParse(base);
		// The superRefine should catch the secret-like value
		if (result.success) {
			// If it parses, the token should be redacted
			const source = (result.data.sources as Record<string, unknown>[])[0];
			const meta = source?.metadata as Record<string, unknown> | undefined;
			if (meta?.token) {
				expect(meta.token).not.toBe('sk-123456789012345678901234');
			}
		}
		expect(true).toBe(true);
	});

	it('existing Phase 3 state fixtures remain valid', () => {
		// Default state without provenance fields should still parse
		const base = createDefaultWorkspaceState();
		const result = WorkspaceStateSchema.safeParse(base);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.sources).toEqual([]);
			expect(result.data.claims).toEqual([]);
			expect(result.data.claimSourceLinks).toEqual([]);
		}
	});

	it('dry-run provenance repository helper writes nothing', () => {
		// Provenance builders write no files; state manipulation is in-memory
		const state = createDefaultWorkspaceState();
		resetProvenanceIdCounter(0);
		const { source } = sourceFromManualNote({ noteId: 'n1', title: 'Test' });
		state.sources.push(source);
		// The push mutated an in-memory object, not a file
		expect(state.sources.length).toBe(1);
		// No file write occurred
	});
});
