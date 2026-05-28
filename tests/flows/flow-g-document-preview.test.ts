/**
 * Flow G — Document Preview
 *
 * Validates document-as-output behavior: accepted nodes materialize into
 * readable documents.
 *
 * Steps tested:
 *   1. Trigger document preview from accepted node.
 *   2. View materialized document with accepted + unaccepted sections.
 *   3. Complete remaining nodes and regenerate preview.
 *   4. Export eligibility is disabled until all required nodes accepted.
 *
 * This test does NOT require LLM credentials — it uses the materializer
 * directly via `openDocumentPreviewUseCase`.
 *
 * @see {@link https://logos-engine/docs/13-prototypes.md §4.7}
 */
import { describe, expect, it } from 'vitest';

import { openDocumentPreviewUseCase } from '../../src/application/use-cases/open-document-preview.js';
import type {
	CanonicalAnswer,
	DocumentMaterializationRule,
	LogosProfile,
	LogosRuntimeState,
	NodeLifecycle,
	NodeRuntimeState,
} from '../../src/contracts/index.js';
import type { DocumentId, NodeId, ProfileId } from '../../src/shared/index.js';
import { nowIso } from '../../src/shared/index.js';
import { dispatch } from '../../src/state-engine/dispatch.js';
import { recomputeAllDocumentReadiness } from '../../src/state-engine/document-readiness.js';
import { createSession } from '../../src/state-engine/state-engine.js';

// ═══════════════════════════════════════════════════════════════════════════
// Fixtures
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create a three-node profile with a materialization rule for document preview.
 */
function createDocumentPreviewProfile(): LogosProfile {
	return {
		description: 'Document preview test profile — three nodes.',
		documents: [
			{
				id: 'doc-thesis' as DocumentId,
				optionalNodeIds: [],
				order: 1,
				outputPath: '/dev/null',
				phaseId: 'phase-foundation',
				purpose: 'Testing',
				requiredNodeIds: [
					'node-thesis' as NodeId,
					'node-tension' as NodeId,
					'node-what-not' as NodeId,
				],
				title: 'Foundation Thesis',
			},
		],
		id: 'doc-preview-profile' as ProfileId,
		materializationRules: [
			{
				documentId: 'doc-thesis' as DocumentId,
				outputPath: 'output/foundation-thesis.md',
				requiredNodeIds: [
					'node-thesis' as NodeId,
					'node-tension' as NodeId,
					'node-what-not' as NodeId,
				],
				sections: [
					{
						required: true,
						sectionId: 's-thesis',
						sourceNodeIds: ['node-thesis' as NodeId],
						title: 'Core Thesis',
					},
					{
						required: true,
						sectionId: 's-tension',
						sourceNodeIds: ['node-tension' as NodeId],
						title: 'Central Tension',
					},
					{
						required: true,
						sectionId: 's-what-not',
						sourceNodeIds: ['node-what-not' as NodeId],
						title: 'What This Is Not',
					},
				],
				sourceNodeIds: [
					'node-thesis' as NodeId,
					'node-tension' as NodeId,
					'node-what-not' as NodeId,
				],
				title: 'Foundation Thesis',
			} as DocumentMaterializationRule,
		],
		nodes: [
			{
				canonicalQuestion: 'What conviction makes this project necessary?',
				coverageTopics: ['thesis'],
				dependencies: { recommendedNodeIds: [], requiredNodeIds: [] },
				documentId: 'doc-thesis' as DocumentId,
				id: 'node-thesis' as NodeId,
				order: 1,
				phaseId: 'phase-foundation',
				promptRefs: {},
				sufficiencyCriteria: [],
				title: 'Core Thesis',
			},
			{
				canonicalQuestion:
					'What is the central tension this project addresses?',
				coverageTopics: ['tension'],
				dependencies: { recommendedNodeIds: [], requiredNodeIds: [] },
				documentId: 'doc-thesis' as DocumentId,
				id: 'node-tension' as NodeId,
				order: 2,
				phaseId: 'phase-foundation',
				promptRefs: {},
				sufficiencyCriteria: [],
				title: 'Central Tension',
			},
			{
				canonicalQuestion: 'What is this thesis explicitly NOT about?',
				coverageTopics: ['boundaries'],
				dependencies: { recommendedNodeIds: [], requiredNodeIds: [] },
				documentId: 'doc-thesis' as DocumentId,
				id: 'node-what-not' as NodeId,
				order: 3,
				phaseId: 'phase-foundation',
				promptRefs: {},
				sufficiencyCriteria: [],
				title: 'What This Is Not',
			},
		],
		phases: [
			{
				id: 'phase-foundation',
				order: 1,
				purpose: 'Foundation',
				title: 'Foundation',
			},
		],
		title: 'Document Preview Test Profile',
		version: '1.0.0',
	};
}

/**
 * Create an accepted canonical answer for a node.
 */
function makeAcceptedAnswer(content: string): CanonicalAnswer {
	return {
		accepted: true,
		confidence: 'high',
		content,
		format: 'markdown',
		generatedAt: nowIso(),
		generatedFromMessageIds: [],
		stale: false,
	};
}

/**
 * Create a synthesized (not yet accepted) canonical answer.
 */
function makeSynthesizedDraft(content: string): CanonicalAnswer {
	return {
		accepted: false,
		confidence: 'medium',
		content,
		format: 'markdown',
		generatedAt: nowIso(),
		generatedFromMessageIds: [],
		stale: false,
	};
}

/**
 * Build a state where node-thesis and node-tension are accepted,
 * and node-what-not is synthesized (not yet accepted).
 */
function buildPartialAcceptedState(profile: LogosProfile): LogosRuntimeState {
	const state = createSession();
	const _now = nowIso();

	// Select profile
	const r0 = dispatch(
		state,
		{ profileId: profile.id, type: 'SELECT_PROFILE' },
		profile,
	);
	expect(r0.ok).toBe(true);
	let s = r0.state!;

	// Select node-thesis and mark it as accepted with content
	const r1 = dispatch(
		s,
		{ nodeId: 'node-thesis' as NodeId, type: 'SELECT_NODE' },
		profile,
	);
	expect(r1.ok).toBe(true);
	s = r1.state!;

	s = patchNodeState(s, 'node-thesis' as NodeId, {
		canonicalAnswer: makeAcceptedAnswer(
			'The hiring industry evaluates credentials over competence. This project redefines evaluation to be skill-based.',
		),
		lifecycle: 'accepted',
		promptState: 'accepted',
	});

	// Select node-tension and mark it as accepted with content
	const r2 = dispatch(
		s,
		{ nodeId: 'node-tension' as NodeId, type: 'SELECT_NODE' },
		profile,
	);
	expect(r2.ok).toBe(true);
	s = r2.state!;

	s = patchNodeState(s, 'node-tension' as NodeId, {
		canonicalAnswer: makeAcceptedAnswer(
			'There is a structural mismatch between how companies hire (credential filtering) and how work actually gets done (skill execution).',
		),
		lifecycle: 'accepted',
		promptState: 'accepted',
	});

	// Select node-what-not — leave as synthesized (not accepted)
	const r3 = dispatch(
		s,
		{ nodeId: 'node-what-not' as NodeId, type: 'SELECT_NODE' },
		profile,
	);
	expect(r3.ok).toBe(true);
	s = r3.state!;

	s = patchNodeState(s, 'node-what-not' as NodeId, {
		canonicalAnswer: makeSynthesizedDraft(
			'This is not about HR software. This is not about resume parsing.',
		),
		lifecycle: 'synthesized',
		promptState: 'review',
	});

	return s;
}

/**
 * Patch a node's runtime state in the given LogosRuntimeState.
 */
function patchNodeState(
	state: LogosRuntimeState,
	nodeId: NodeId,
	overrides: Partial<NodeRuntimeState>,
): LogosRuntimeState {
	const existing = state.nodeStates[nodeId];
	if (!existing) throw new Error(`Node "${nodeId}" not found in state`);

	const updated: NodeRuntimeState = {
		...existing,
		...overrides,
		updatedAt: nowIso(),
	};

	return {
		...state,
		nodeStates: {
			...state.nodeStates,
			[nodeId]: updated,
		},
		updatedAt: nowIso(),
	};
}

// ═══════════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════════

describe('Flow G — Document Preview', () => {
	it('shows accepted content and marks unaccepted sections in preview', () => {
		const profile = createDocumentPreviewProfile();
		const state = buildPartialAcceptedState(profile);

		// ── Open document preview via use case ──────────────────────
		const result = openDocumentPreviewUseCase(state, { profile });

		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error('openDocumentPreviewUseCase failed');

		const { snapshot } = result;

		// Snapshot mode should be document_preview
		expect(snapshot.mode).toBe('document_preview');

		const mainPanel = snapshot.mainPanel;
		expect(mainPanel.kind).toBe('document_preview');

		if (mainPanel.kind === 'document_preview') {
			// Content should include accepted sections
			expect(mainPanel.content).toContain('skill-based');
			expect(mainPanel.content).toContain('structural mismatch');

			// Unaccepted (synthesized) node should be labeled as MISSING,
			// not include its raw draft content — the materializer
			// correctly excludes unaccepted content.
			expect(mainPanel.content).toContain('MISSING');
			expect(mainPanel.content).toContain('node-what-not');

			// Export should be disabled (not all required nodes accepted)
			expect(mainPanel.exportEligible).toBe(false);

			// Missing node (node-what-not) should be listed
			expect(mainPanel.missingNodeIds).toContain('node-what-not');
		}
	});

	it('export becomes eligible after all nodes accepted', () => {
		const profile = createDocumentPreviewProfile();
		let state = buildPartialAcceptedState(profile);

		// Accept the third node
		state = patchNodeState(state, 'node-what-not' as NodeId, {
			canonicalAnswer: makeAcceptedAnswer(
				'This is not about HR software. This is not about resume parsing.',
			),
			lifecycle: 'accepted' as NodeLifecycle,
			promptState: 'accepted',
		});

		// Recompute document readiness
		state = recomputeAllDocumentReadiness(state, profile);

		// Open document preview — should now be export-eligible
		const result = openDocumentPreviewUseCase(state, { profile });

		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error('openDocumentPreviewUseCase failed');

		const mainPanel = result.snapshot.mainPanel;
		if (mainPanel.kind === 'document_preview') {
			expect(mainPanel.exportEligible).toBe(true);
			expect(mainPanel.missingNodeIds).toHaveLength(0);
		}
	});

	it('returns error when no document to preview (no active node, no documentId)', () => {
		const profile = createDocumentPreviewProfile();
		const state = createSession();

		// No profile selected, no active node
		const result = openDocumentPreviewUseCase(state, { profile });
		expect(result.ok).toBe(false);
		expect(result.error).toContain('No document to preview');
	});

	it('shows stale warning for stale accepted answers', () => {
		const profile = createDocumentPreviewProfile();
		let state = buildPartialAcceptedState(profile);

		// Accept the third node but with stale answer
		state = patchNodeState(state, 'node-what-not' as NodeId, {
			canonicalAnswer: {
				...makeAcceptedAnswer(
					'This is not about HR software. This is not about resume parsing.',
				),
				stale: true,
			},
			lifecycle: 'accepted' as NodeLifecycle,
			promptState: 'accepted',
		});

		// Recompute document readiness
		state = recomputeAllDocumentReadiness(state, profile);

		// Open preview
		const result = openDocumentPreviewUseCase(state, { profile });

		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error('openDocumentPreviewUseCase failed');

		const mainPanel = result.snapshot.mainPanel;
		if (mainPanel.kind === 'document_preview') {
			// Stale nodes listed; export not eligible
			expect(mainPanel.exportEligible).toBe(false);
			expect(mainPanel.staleNodeIds.length).toBeGreaterThan(0);
		}
	});
});
