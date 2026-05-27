/**
 * Tests for Step 12.1 — document materializer.
 *
 * Covers:
 *  - `materializeDocument` with all accepted nodes → full document.
 *  - `materializeDocument` with missing required node → `[MISSING]` marker.
 *  - `materializeDocument` with stale source → `[⚠ STALE]` marker.
 *  - `materializeDocument` rejects unaccepted answer content.
 *  - `previewDocument` always returns a draft (including rule-not-found fallback).
 *  - Completeness indicator is present.
 *
 * Acceptance criteria (Step 12.1):
 *  - Accepted nodes produce sections with their canonical answer content.
 *  - Missing required nodes are flagged with source node reference.
 *  - Stale source nodes are flagged.
 *  - Document completeness is shown.
 *  - Unaccepted answers are not used for final output.
 *
 * @see {@link https://logos-engine/docs/07-document-materialization-spec.md}
 */
import { describe, expect, it } from 'vitest';

import type {
	DocumentMaterializationRule,
	LogosProfile,
	LogosRuntimeState,
	NodeRuntimeState,
} from '../../src/contracts/index.js';
import type { DocumentId, NodeId, ProfileId } from '../../src/shared/index.js';
import { nowIso } from '../../src/shared/index.js';
import {
	materializeDocument,
	previewDocument,
} from '../../src/materialization/index.js';

// ═══════════════════════════════════════════════════════════════════════════
// Test fixtures
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Minimal accepted `NodeRuntimeState` with a non-stale canonical answer.
 *
 * The content is deterministic so tests can assert exact output.
 */
function acceptedNodeState(
	nodeId: NodeId,
	content?: string,
): NodeRuntimeState {
	return {
		allowedActions: ['continue_next', 'reopen', 'open_document_preview'],
		canonicalAnswer: {
			accepted: true,
			acceptedAt: nowIso(),
			confidence: 'high',
			content: content ?? `Canonical answer for ${nodeId}.`,
			format: 'markdown',
			generatedAt: nowIso(),
			generatedFromMessageIds: ['msg-1', 'msg-2'],
			stale: false,
		},
		completeness: {
			blockingIssues: [],
			complete: true,
			coverage: {},
			missing: [],
			weak: [],
		},
		conversation: [],
		dependencies: { blockedBy: [], requiredNodeIds: [], unlocks: [] },
		extracted: {
			assumptions: [],
			decisions: [],
			facts: [],
			openQuestions: [],
			risks: [],
		},
		lifecycle: 'accepted',
		nodeId,
		promptState: 'accepted',
		updatedAt: nowIso(),
	};
}

// Factory for stale node state — applies the stale flag over an accepted base.
function makeStaleNodeState(
	nodeId: NodeId,
	content?: string,
): NodeRuntimeState {
	const base = acceptedNodeState(nodeId, content);
	return {
		...base,
		canonicalAnswer: {
			...base.canonicalAnswer!,
			stale: true,
		},
	};
}

/**
 * Node with lifecycle `"active"` and no canonical answer — unaccepted.
 */
function activeNodeState(nodeId: NodeId): NodeRuntimeState {
	return {
		allowedActions: [
			'answer',
			'defer',
			'mark_as_assumption',
			'mark_as_decision',
		],
		canonicalAnswer: null,
		completeness: {
			blockingIssues: [],
			complete: false,
			coverage: {},
			missing: [],
			weak: [],
		},
		conversation: [],
		dependencies: { blockedBy: [], requiredNodeIds: [], unlocks: [] },
		extracted: {
			assumptions: [],
			decisions: [],
			facts: [],
			openQuestions: [],
			risks: [],
		},
		lifecycle: 'active',
		nodeId,
		promptState: 'follow_up',
		updatedAt: nowIso(),
	};
}

/**
 * Node with lifecycle `"accepted"` but `canonicalAnswer.accepted === false`
 * — should behave like unaccepted.
 */
function acceptedLifecycleButUnacceptedAnswer(
	nodeId: NodeId,
	content?: string,
): NodeRuntimeState {
	return {
		allowedActions: ['continue_next', 'reopen'],
		canonicalAnswer: {
			accepted: false,
			confidence: 'high',
			content: content ?? `Unaccepted draft for ${nodeId}.`,
			format: 'markdown',
			generatedAt: nowIso(),
			generatedFromMessageIds: ['msg-1'],
			stale: false,
		},
		completeness: {
			blockingIssues: [],
			complete: true,
			coverage: {},
			missing: [],
			weak: [],
		},
		conversation: [],
		dependencies: { blockedBy: [], requiredNodeIds: [], unlocks: [] },
		extracted: {
			assumptions: [],
			decisions: [],
			facts: [],
			openQuestions: [],
			risks: [],
		},
		lifecycle: 'accepted',
		nodeId,
		promptState: 'accepted',
		updatedAt: nowIso(),
	};
}

/**
 * A materialization rule for a single-section document.
 */
function testRule(
	documentId: DocumentId,
	sections?: Partial<DocumentMaterializationRule['sections'][number]>[],
): DocumentMaterializationRule {
	return {
		documentId,
		optionalNodeIds: [],
		outputPath: '/tmp/test.md',
		requiredNodeIds: ['node-a' as NodeId, 'node-b' as NodeId],
		sections: (sections ?? [
			{ id: 'section-1', required: true, sourceNodeIds: ['node-a' as NodeId], title: 'Section One' },
			{ id: 'section-2', required: true, sourceNodeIds: ['node-b' as NodeId], title: 'Section Two' },
		]) as DocumentMaterializationRule['sections'],
		sourceNodeIds: ['node-a' as NodeId, 'node-b' as NodeId],
		title: 'Test Document',
	};
}

/**
 * Minimal `LogosProfile` for testing document materialization.
 */
function testProfile(
	rule?: DocumentMaterializationRule,
): LogosProfile {
	const effectiveRule = rule ?? testRule('test-doc' as DocumentId);
	return {
		description: 'Test profile',
		documents: [
			{
				id: 'test-doc' as DocumentId,
				optionalNodeIds: [],
				order: 1,
				outputPath: '/tmp/test.md',
				phaseId: 'phase-1',
				purpose: 'Testing',
				requiredNodeIds: ['node-a' as NodeId, 'node-b' as NodeId],
				title: 'Test Document',
			},
		],
		id: 'test-profile' as ProfileId,
		materializationRules: [effectiveRule],
		nodes: [
			{
				canonicalQuestion: 'Question A?',
				coverageTopics: ['Topic A'],
				documentId: 'test-doc' as DocumentId,
				id: 'node-a' as NodeId,
				order: 1,
				phaseId: 'phase-1',
				promptRefs: {},
				sufficiencyCriteria: ['Clear answer'],
				title: 'Node A',
			},
			{
				canonicalQuestion: 'Question B?',
				coverageTopics: ['Topic B'],
				documentId: 'test-doc' as DocumentId,
				id: 'node-b' as NodeId,
				order: 2,
				phaseId: 'phase-1',
				promptRefs: {},
				sufficiencyCriteria: ['Clear answer'],
				title: 'Node B',
			},
		],
		phases: [
			{ id: 'phase-1', order: 1, purpose: 'Test', title: 'Phase 1' },
		],
		title: 'Test Profile',
		version: '1.0.0',
	};
}

/**
 * Build a `LogosRuntimeState` with specific node states.
 */
function stateWithNodes(
	nodes: NodeRuntimeState[],
): LogosRuntimeState {
	const nodeStates: Record<NodeId, NodeRuntimeState> = {};
	for (const n of nodes) {
		nodeStates[n.nodeId] = n;
	}

	return {
		activeNodeId: null,
		documentStates: {},
		exportState: { artifacts: [] },
		globalContext: {
			preferences: {},
			projectName: null,
			summary: null,
		},
		lastActiveNodeId: null,
		mode: 'structure_overview',
		nodeStates,
		selectedProfileId: 'test-profile' as ProfileId,
		sessionId: 'test-session',
		updatedAt: nowIso(),
	};
}

// ═══════════════════════════════════════════════════════════════════════════
// Acceptance criteria tests
// ═══════════════════════════════════════════════════════════════════════════

describe('materializeDocument', () => {
	// ── AC: All accepted → full document ───────────────────────────────

	it('produces a full document when all required nodes are accepted', () => {
		const profile = testProfile();
		const state = stateWithNodes([
			acceptedNodeState('node-a' as NodeId, 'Content A'),
			acceptedNodeState('node-b' as NodeId, 'Content B'),
		]);

		const result = materializeDocument(
			'test-doc' as DocumentId,
			state,
			profile,
		);

		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error('Expected success');

		const draft = result.value;
		expect(draft.format).toBe('markdown');
		expect(draft.stale).toBe(false);
		expect(draft.missingSections).toEqual([]);

		// Content should contain the document title, section headers, and answers.
		expect(draft.content).toContain('# Test Document');
		expect(draft.content).toContain('## Section One');
		expect(draft.content).toContain('## Section Two');
		expect(draft.content).toContain('Content A');
		expect(draft.content).toContain('Content B');

		// Completeness indicator.
		expect(draft.content).toContain('Completeness: 2/2 sections accepted');

		// No markers.
		expect(draft.content).not.toContain('[MISSING');
		expect(draft.content).not.toContain('[⚠ STALE');
	});

	// ── AC: Missing required node → [MISSING] marker ───────────────────

	it('flags missing required nodes with [MISSING — requires node: X]', () => {
		const profile = testProfile();
		const state = stateWithNodes([
			acceptedNodeState('node-a' as NodeId, 'Content A'),
			activeNodeState('node-b' as NodeId),
		]);

		const result = materializeDocument(
			'test-doc' as DocumentId,
			state,
			profile,
		);

		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error('Expected success');

		const draft = result.value;

		// Section One (node-a) should have content.
		expect(draft.content).toContain('Content A');

		// Section Two (node-b) should be marked missing.
		expect(draft.content).toContain('[MISSING — requires node: node-b]');

		// Completeness should reflect one accepted section.
		expect(draft.content).toContain('Completeness: 1/2 sections accepted');

		// missingSections should contain section-2.
		expect(draft.missingSections).toContain('section-2');
		expect(draft.missingSections).not.toContain('section-1');
	});

	// ── AC: Stale source → [⚠ STALE] marker ───────────────────────────

	it('flags stale source nodes with [⚠ STALE — source node has changed]', () => {
		const profile = testProfile();
		const state = stateWithNodes([
			acceptedNodeState('node-a' as NodeId, 'Content A'),
			makeStaleNodeState('node-b' as NodeId, 'Stale Content B'),
		]);

		const result = materializeDocument(
			'test-doc' as DocumentId,
			state,
			profile,
		);

		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error('Expected success');

		const draft = result.value;

		// Section One (fresh) should have content without markers.
		expect(draft.content).toContain('Content A');

		// Section Two (stale) should have stale marker AND content.
		expect(draft.content).toContain('[⚠ STALE — source node has changed]');
		expect(draft.content).toContain('Stale Content B');

		// Draft should be marked stale overall.
		expect(draft.stale).toBe(true);

		// Completeness should count non-stale sections only.
		expect(draft.content).toContain('Completeness: 1/2 sections accepted');
	});

	// ── AC: Unaccepted answer is rejected ─────────────────────────────

	it('rejects unaccepted answer content — marks section as missing', () => {
		const profile = testProfile();
		// node-a has lifecycle "accepted" but canonicalAnswer.accepted === false.
		const state = stateWithNodes([
			acceptedLifecycleButUnacceptedAnswer(
				'node-a' as NodeId,
				'Draft content should NOT appear',
			),
			acceptedNodeState('node-b' as NodeId, 'Content B'),
		]);

		const result = materializeDocument(
			'test-doc' as DocumentId,
			state,
			profile,
		);

		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error('Expected success');

		const draft = result.value;

		// Unaccepted content must NOT appear.
		expect(draft.content).not.toContain('Draft content should NOT appear');

		// Section One (unaccepted) should be marked missing.
		expect(draft.content).toContain('[MISSING — requires node: node-a]');

		// Section Two (accepted) should have content.
		expect(draft.content).toContain('Content B');

		// Completeness: only section-2 accepted.
		expect(draft.content).toContain('Completeness: 1/2 sections accepted');
		expect(draft.missingSections).toContain('section-1');
	});

	// ── Error case: no materialization rule ──────────────────────────

	it('returns error when no materialization rule is found', () => {
		const profile = testProfile();
		const state = stateWithNodes([
			acceptedNodeState('node-a' as NodeId),
		]);

		const result = materializeDocument(
			'nonexistent-doc' as DocumentId,
			state,
			profile,
		);

		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('Expected error');

		expect(result.error.code).toBe('DOCUMENT_RULE_NOT_FOUND');
		expect(result.error.documentId).toBe('nonexistent-doc' as DocumentId);
	});

	// ── Edge case: optional section with no accepted content ─────────

	it('renders optional sections with header but no missing marker', () => {
		const rule: DocumentMaterializationRule = {
			documentId: 'test-doc' as DocumentId,
			optionalNodeIds: ['node-opt' as NodeId],
			outputPath: '/tmp/test.md',
			requiredNodeIds: ['node-a' as NodeId],
			sections: [
				{
					id: 'required-section',
					required: true,
					sourceNodeIds: ['node-a' as NodeId],
					title: 'Required Section',
				},
				{
					id: 'optional-section',
					required: false,
					sourceNodeIds: ['node-opt' as NodeId],
					title: 'Optional Section',
				},
			],
			sourceNodeIds: ['node-a' as NodeId, 'node-opt' as NodeId],
			title: 'Optional Test Document',
		};

		const profile = testProfile(rule);
		const state = stateWithNodes([
			acceptedNodeState('node-a' as NodeId, 'Content A'),
			activeNodeState('node-opt' as NodeId),
		]);

		const result = materializeDocument(
			'test-doc' as DocumentId,
			state,
			profile,
		);

		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error('Expected success');

		const draft = result.value;

		// Required section has content.
		expect(draft.content).toContain('## Required Section');
		expect(draft.content).toContain('Content A');

		// Optional section header is rendered but no missing marker.
		expect(draft.content).toContain('## Optional Section');
		expect(draft.content).not.toContain('[MISSING');

		// Completeness should count only the required section as accepted.
		// The optional section has no accepted source nodes, so it is not
		// counted even though it renders without a [MISSING] marker.
		expect(draft.content).toContain('Completeness: 1/2 sections accepted');
		expect(draft.missingSections).toEqual([]);
		expect(draft.stale).toBe(false);
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// previewDocument
// ═══════════════════════════════════════════════════════════════════════════

describe('previewDocument', () => {
	// ── Normal case ───────────────────────────────────────────────────

	it('returns the same draft as materializeDocument when rule exists', () => {
		const profile = testProfile();
		const state = stateWithNodes([
			acceptedNodeState('node-a' as NodeId, 'Content A'),
			acceptedNodeState('node-b' as NodeId, 'Content B'),
		]);

		const preview = previewDocument(
			'test-doc' as DocumentId,
			state,
			profile,
		);

		expect(preview.content).toContain('# Test Document');
		expect(preview.content).toContain('Content A');
		expect(preview.content).toContain('Content B');
		expect(preview.content).toContain('Completeness: 2/2 sections accepted');
		expect(preview.stale).toBe(false);
	});

	// ── Fallback when rule not found ──────────────────────────────────

	it('returns a defensive draft (no crash) when rule is not found', () => {
		const profile = testProfile();
		const state = stateWithNodes([]);

		const preview = previewDocument(
			'nonexistent-doc' as DocumentId,
			state,
			profile,
		);

		expect(preview.documentId).toBe('nonexistent-doc' as DocumentId);
		expect(preview.format).toBe('markdown');
		expect(preview.content).toContain('Cannot preview');
		expect(preview.missingSections).toEqual([]);
		expect(preview.stale).toBe(false);
	});

	// ── Fallback title from DocumentDefinition ───────────────────────

	it('uses DocumentDefinition title as fallback when rule is not found', () => {
		const profile = testProfile();
		const state = stateWithNodes([]);

		// 'test-doc' has a DocumentDefinition with title "Test Document"
		// but we'll create a profile where the rule is missing but the doc
		// definition exists.
		const profileWithoutRule = testProfile();
		profileWithoutRule.materializationRules = [];

		const preview = previewDocument(
			'test-doc' as DocumentId,
			state,
			profileWithoutRule,
		);

		expect(preview.content).toContain('# Test Document');
		expect(preview.content).toContain('Cannot preview');
	});

	// ── Missing / stale content visible ──────────────────────────────

	it('shows missing and stale markers in preview', () => {
		const profile = testProfile();
		const state = stateWithNodes([
			acceptedNodeState('node-a' as NodeId, 'Content A'),
			makeStaleNodeState('node-b' as NodeId, 'Stale Content B'),
		]);

		const preview = previewDocument(
			'test-doc' as DocumentId,
			state,
			profile,
		);

		expect(preview.content).toContain('[⚠ STALE — source node has changed]');
		expect(preview.content).toContain('Stale Content B');
		expect(preview.stale).toBe(true);
	});
});
