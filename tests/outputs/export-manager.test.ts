/**
 * Tests for Step 16.2 — Export manager.
 *
 * Covers:
 *  - Ready document → available for Markdown export.
 *  - Incomplete document → unavailable with blocked reason.
 *  - Stale document → unavailable with blocked reason.
 *  - No materialization rule → unavailable with blocked reason.
 *  - HTML mirrors Markdown readiness (same gates).
 *  - Agent Pack → unavailable (placeholder).
 *  - Multiple documents → each gets availability entries.
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
import { getAvailableExports } from '../../src/outputs/index.js';
import type { ExportAvailability } from '../../src/outputs/index.js';
import type { DocumentId, NodeId, ProfileId } from '../../src/shared/index.js';
import { nowIso } from '../../src/shared/index.js';

// ═══════════════════════════════════════════════════════════════════════════
// Test helpers
// ═══════════════════════════════════════════════════════════════════════════

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

function staleNodeState(
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

function activeNodeState(nodeId: NodeId): NodeRuntimeState {
	return {
		allowedActions: ['answer', 'defer'],
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

function testRule(documentId: DocumentId): DocumentMaterializationRule {
	return {
		documentId,
		optionalNodeIds: [],
		outputPath: `/tmp/${String(documentId)}.md`,
		requiredNodeIds: ['node-a' as NodeId],
		sections: [
			{
				id: 'section-1',
				required: true,
				sourceNodeIds: ['node-a' as NodeId],
				title: 'Section One',
			},
		],
		sourceNodeIds: ['node-a' as NodeId],
		title: `Document ${String(documentId)}`,
	};
}

function testProfile(
	rules?: DocumentMaterializationRule[],
): LogosProfile {
	const effectiveRules =
		rules ?? [testRule('test-doc' as DocumentId)];

	return {
		description: 'Test profile',
		documents: effectiveRules.map((r) => ({
			id: r.documentId,
			optionalNodeIds: [],
			order: 1,
			outputPath: r.outputPath,
			phaseId: 'phase-1',
			purpose: 'Testing',
			requiredNodeIds: r.requiredNodeIds,
			title: r.title,
		})),
		id: 'test-profile' as ProfileId,
		materializationRules: effectiveRules,
		nodes: [
			{
				canonicalQuestion: 'Question?',
				coverageTopics: ['Topic'],
				documentId: 'test-doc' as DocumentId,
				id: 'node-a' as NodeId,
				order: 1,
				phaseId: 'phase-1',
				promptRefs: {},
				sufficiencyCriteria: ['Clear answer'],
				title: 'Node A',
			},
		],
		phases: [
			{ id: 'phase-1', order: 1, purpose: 'Test', title: 'Phase 1' },
		],
		title: 'Test Profile',
		version: '1.0.0',
	};
}

function stateWithNodes(
	nodes: NodeRuntimeState[],
	overrides?: Partial<LogosRuntimeState>,
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
		...overrides,
	};
}

// ═══════════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════════

describe('getAvailableExports', () => {
	// ── AC: Ready document → Markdown available ────────────────────

	it('marks Markdown as available for a ready document', () => {
		const profile = testProfile();
		const state = stateWithNodes([
			acceptedNodeState('node-a' as NodeId, 'Content.'),
		]);

		const avail = getAvailableExports(state, profile);

		const mdEntry = avail.find(
			(e) =>
				e.documentId === ('test-doc' as DocumentId) &&
				e.format === 'markdown',
		);
		expect(mdEntry).toBeDefined();
		expect(mdEntry!.available).toBe(true);
		expect(mdEntry!.blockedReason).toBeUndefined();
		expect(mdEntry!.documentTitle).toBe('Document test-doc');
	});

	// ── AC: Incomplete document → blocked ─────────────────────────

	it('marks Markdown as unavailable for an incomplete document', () => {
		const profile = testProfile();
		const state = stateWithNodes([
			activeNodeState('node-a' as NodeId),
		]);

		const avail = getAvailableExports(state, profile);

		const mdEntry = avail.find(
			(e) =>
				e.documentId === ('test-doc' as DocumentId) &&
				e.format === 'markdown',
		);
		expect(mdEntry).toBeDefined();
		expect(mdEntry!.available).toBe(false);
		expect(mdEntry!.blockedReason).toBeDefined();
		expect(mdEntry!.blockedReason!.length).toBeGreaterThan(0);
	});

	// ── AC: Stale document → blocked ──────────────────────────────

	it('marks Markdown as unavailable for a stale document', () => {
		const profile = testProfile();
		const state = stateWithNodes([
			staleNodeState('node-a' as NodeId, 'Stale.'),
		]);

		const avail = getAvailableExports(state, profile);

		const mdEntry = avail.find(
			(e) =>
				e.documentId === ('test-doc' as DocumentId) &&
				e.format === 'markdown',
		);
		expect(mdEntry).toBeDefined();
		expect(mdEntry!.available).toBe(false);
		expect(mdEntry!.blockedReason).toMatch(/stale/i);
	});

	// ── AC: No materialization rule → blocked ─────────────────────

	it('marks Markdown as unavailable when no rule exists', () => {
		const profile: LogosProfile = {
			...testProfile(),
			materializationRules: [],
		};
		const state = stateWithNodes([
			acceptedNodeState('node-a' as NodeId, 'Content.'),
		]);

		const avail = getAvailableExports(state, profile);

		const mdEntry = avail.find(
			(e) =>
				e.documentId === ('test-doc' as DocumentId) &&
				e.format === 'markdown',
		);
		expect(mdEntry).toBeDefined();
		expect(mdEntry!.available).toBe(false);
		expect(mdEntry!.blockedReason).toMatch(/No materialization rule/i);
	});

	// ── AC: HTML mirrors Markdown readiness; Agent Pack still placeholder ─

	it('marks HTML as available when document is ready (same gate as Markdown)', () => {
		const profile = testProfile();
		const state = stateWithNodes([
			acceptedNodeState('node-a' as NodeId, 'Content.'),
		]);

		const avail = getAvailableExports(state, profile);

		const htmlEntry = avail.find(
			(e) =>
				e.documentId === ('test-doc' as DocumentId) &&
				e.format === 'html',
		);
		expect(htmlEntry).toBeDefined();
		expect(htmlEntry!.available).toBe(true);
		expect(htmlEntry!.blockedReason).toBeUndefined();
	});

	it('marks HTML as unavailable when document is incomplete (same gate as Markdown)', () => {
		const profile = testProfile();
		const state = stateWithNodes([
			activeNodeState('node-a' as NodeId),
		]);

		const avail = getAvailableExports(state, profile);

		const htmlEntry = avail.find(
			(e) =>
				e.documentId === ('test-doc' as DocumentId) &&
				e.format === 'html',
		);
		expect(htmlEntry).toBeDefined();
		expect(htmlEntry!.available).toBe(false);
		expect(htmlEntry!.blockedReason).toBeDefined();
	});

	it('marks Agent Pack as unavailable with placeholder reason', () => {
		const profile = testProfile();
		const state = stateWithNodes([
			acceptedNodeState('node-a' as NodeId, 'Content.'),
		]);

		const avail = getAvailableExports(state, profile);

		const apEntry = avail.find(
			(e) =>
				e.documentId === ('test-doc' as DocumentId) &&
				e.format === 'agent_pack',
		);
		expect(apEntry).toBeDefined();
		expect(apEntry!.available).toBe(false);
		expect(apEntry!.blockedReason).toMatch(/not yet implemented|Phase 17/i);
	});

	// ── AC: Each document gets all three format entries ───────────

	it('returns three entries per document (markdown, html, agent_pack)', () => {
		const rule1 = testRule('doc-1' as DocumentId);
		const rule2 = testRule('doc-2' as DocumentId);
		const profile = testProfile([rule1, rule2]);

		const state = stateWithNodes([
			acceptedNodeState('node-a' as NodeId, 'Content.'),
		]);

		const avail = getAvailableExports(state, profile);

		// 2 documents × 3 formats = 6 entries.
		expect(avail.length).toBe(6);

		const formatsPerDoc = new Map<
			string,
			{ documentTitle: string; formats: string[] }
		>();
		for (const entry of avail) {
			const key = String(entry.documentId);
			if (!formatsPerDoc.has(key)) {
				formatsPerDoc.set(key, {
					documentTitle: entry.documentTitle,
					formats: [],
				});
			}
			formatsPerDoc.get(key)!.formats.push(entry.format);
		}

		expect(formatsPerDoc.size).toBe(2);
		for (const [, info] of formatsPerDoc) {
			expect(info.formats.sort()).toEqual([
				'agent_pack',
				'html',
				'markdown',
			]);
		}
	});

	// ── Edge: Partially ready document → blocked with reason ─────

	it('reports specific missing nodes for a partially ready document', () => {
		// Create a rule requiring two nodes but only one accepted.
		const rule: DocumentMaterializationRule = {
			...testRule('test-doc' as DocumentId),
			requiredNodeIds: ['node-a' as NodeId, 'node-b' as NodeId],
			sections: [
				{
					id: 'section-1',
					required: true,
					sourceNodeIds: ['node-a' as NodeId],
					title: 'Section One',
				},
				{
					id: 'section-2',
					required: true,
					sourceNodeIds: ['node-b' as NodeId],
					title: 'Section Two',
				},
			],
			sourceNodeIds: ['node-a' as NodeId, 'node-b' as NodeId],
		};

		const profile = testProfile([rule]);
		const state = stateWithNodes([
			acceptedNodeState('node-a' as NodeId, 'Content A.'),
			activeNodeState('node-b' as NodeId),
		]);

		const avail = getAvailableExports(state, profile);

		const mdEntry = avail.find(
			(e) =>
				e.documentId === ('test-doc' as DocumentId) &&
				e.format === 'markdown',
		);
		expect(mdEntry).toBeDefined();
		expect(mdEntry!.available).toBe(false);
		// The blocked reason should mention node-b.
		expect(mdEntry!.blockedReason).toMatch(/node-b/);
	});
});
