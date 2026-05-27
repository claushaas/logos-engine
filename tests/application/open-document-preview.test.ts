/**
 * Tests for Step 12.2 — open-document-preview use case.
 *
 * Covers:
 *  - Builds `document_preview` render snapshot.
 *  - Stores regenerated draft in returned state.
 *  - Export enabled when all required sections are fresh and draft exists.
 *  - Export disabled when missing/stale.
 */
import { describe, expect, it } from 'vitest';

import type { DocumentId, NodeId, ProfileId } from '../../src/shared/index.js';
import type {
	LogosProfile,
	LogosRuntimeState,
} from '../../src/contracts/index.js';
import {
	openDocumentPreviewUseCase,
} from '../../src/application/use-cases/open-document-preview.js';

// ═══════════════════════════════════════════════════════════════════════════
// Fixtures
// ═══════════════════════════════════════════════════════════════════════════

function testProfile(): LogosProfile {
	return {
		description: 'Test profile for open-document-preview tests',
		documents: [
			{
				id: 'doc-1' as DocumentId,
				optionalNodeIds: [],
				order: 1,
				outputPath: '/dev/null',
				phaseId: 'phase-1',
				purpose: 'Testing',
				requiredNodeIds: ['n1' as NodeId, 'n2' as NodeId],
				title: 'Test Document',
			},
		],
		id: 'test-p' as ProfileId,
		materializationRules: [
			{
				documentId: 'doc-1' as DocumentId,
				outputPath: '/dev/null',
				requiredNodeIds: ['n1' as NodeId, 'n2' as NodeId],
				optionalNodeIds: [],
				sections: [
					{
						required: true,
						sectionId: 's1',
						sourceNodeIds: ['n1' as NodeId, 'n2' as NodeId],
						title: 'Section 1',
					},
				],
				sourceNodeIds: ['n1' as NodeId, 'n2' as NodeId],
				title: 'Test Document',
			},
		],
		nodes: [
			{
				canonicalQuestion: 'Q1?',
				coverageTopics: ['topic1'],
				dependencies: {},
				documentId: 'doc-1' as DocumentId,
				id: 'n1' as NodeId,
				order: 1,
				phaseId: 'phase-1',
				promptRefs: {},
				sufficiencyCriteria: [],
				title: 'Node 1',
			},
			{
				canonicalQuestion: 'Q2?',
				coverageTopics: ['topic2'],
				dependencies: {},
				documentId: 'doc-1' as DocumentId,
				id: 'n2' as NodeId,
				order: 2,
				phaseId: 'phase-1',
				promptRefs: {},
				sufficiencyCriteria: [],
				title: 'Node 2',
			},
		],
		phases: [
			{
				id: 'phase-1',
				nodes: ['n1' as NodeId, 'n2' as NodeId],
				order: 1,
				purpose: 'Testing',
				title: 'Phase 1',
			},
		],
		title: 'Test Profile',
		version: '1.0.0',
	};
}

/**
 * State with one accepted node (n1) and one not-started node (n2).
 * This gives us partial completeness.
 */
function partialState(): LogosRuntimeState {
	return {
		activeNodeId: 'n1' as NodeId,
		documentStates: {
			['doc-1' as DocumentId]: {
				documentId: 'doc-1' as DocumentId,
				draft: null,
				missingRequiredNodeIds: ['n2' as NodeId],
				optionalNodeIds: [],
				requiredNodeIds: ['n1' as NodeId, 'n2' as NodeId],
				sourceNodeIds: ['n1' as NodeId, 'n2' as NodeId],
				staleSourceNodeIds: [],
				status: 'partially_ready',
				updatedAt: '2025-01-15T10:00:00.000Z',
			},
		},
		exportState: {
			artifacts: [],
			exportHistory: [],
			pendingExports: [],
		},
		globalContext: {
			preferences: {},
			projectName: 'Test',
			summary: 'Test project.',
		},
		lastActiveNodeId: 'n1' as NodeId,
		mode: 'node_focus',
		nodeStates: {
			['n1' as NodeId]: {
				allowedActions: [],
				canonicalAnswer: {
					accepted: true,
					acceptedAt: '2025-01-15T09:00:00.000Z',
					confidence: 'high',
					content: 'This is the accepted answer for node 1.',
					generatedAt: '2025-01-15T09:00:00.000Z',
					generatedFromMessageIds: ['msg-1'],
					id: 'can-1',
					nodeId: 'n1' as NodeId,
					promptState: 'accepted',
					stale: false,
				},
				completeness: {
					complete: true,
					missing: [],
					score: 100,
					weak: [],
				},
				conversation: [
					{
						content: 'User answer for node 1.',
						createdAt: '2025-01-15T09:00:00.000Z',
						id: 'msg-1',
						role: 'user',
					},
				],
				dependencies: {
					blockedBy: [],
					requiredNodeIds: [],
					unlocks: ['n2' as NodeId],
				},
				extracted: {
					assumptions: [],
					decisions: [],
					facts: [],
					risks: [],
				},
				lastAssistantMessageId: undefined,
				lastUserMessageId: 'msg-1',
				lifecycle: 'accepted',
				nodeId: 'n1' as NodeId,
				promptState: 'accepted',
				updatedAt: '2025-01-15T09:00:00.000Z',
			},
			['n2' as NodeId]: {
				allowedActions: [],
				canonicalAnswer: null,
				completeness: {
					complete: false,
					missing: ['topic2'],
					score: 0,
					weak: [],
				},
				conversation: [],
				dependencies: {
					blockedBy: [],
					requiredNodeIds: [],
					unlocks: [],
				},
				extracted: {
					assumptions: [],
					decisions: [],
					facts: [],
					risks: [],
				},
				lastAssistantMessageId: undefined,
				lastUserMessageId: undefined,
				lifecycle: 'not_started',
				nodeId: 'n2' as NodeId,
				promptState: 'initial',
				updatedAt: '2025-01-15T10:00:00.000Z',
			},
		},
		selectedProfileId: 'test-p' as ProfileId,
		sessionId: 's1',
		updatedAt: '2025-01-15T10:00:00.000Z',
	};
}

/**
 * State with both nodes accepted.  This gives full completeness / export-ready.
 */
function fullyAcceptedState(): LogosRuntimeState {
	const state = partialState();
	const n2State = state.nodeStates['n2' as NodeId]!;

	return {
		...state,
		documentStates: {
			['doc-1' as DocumentId]: {
				documentId: 'doc-1' as DocumentId,
				draft: null,
				missingRequiredNodeIds: [],
				optionalNodeIds: [],
				requiredNodeIds: ['n1' as NodeId, 'n2' as NodeId],
				sourceNodeIds: ['n1' as NodeId, 'n2' as NodeId],
				staleSourceNodeIds: [],
				status: 'ready',
				updatedAt: '2025-01-15T10:00:00.000Z',
			},
		},
		nodeStates: {
			...state.nodeStates,
			['n2' as NodeId]: {
				...n2State,
				canonicalAnswer: {
					accepted: true,
					acceptedAt: '2025-01-15T10:00:00.000Z',
					confidence: 'high',
					content: 'This is the accepted answer for node 2.',
					generatedAt: '2025-01-15T10:00:00.000Z',
					generatedFromMessageIds: ['msg-2'],
					id: 'can-2',
					nodeId: 'n2' as NodeId,
					promptState: 'accepted',
					stale: false,
				},
				lastUserMessageId: 'msg-2',
				lifecycle: 'accepted',
			},
		},
	};
}

// ═══════════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════════

describe('openDocumentPreviewUseCase', () => {
	it('builds a document_preview render snapshot', () => {
		const profile = testProfile();
		const state = partialState();

		const result = openDocumentPreviewUseCase(state, {
			documentId: 'doc-1' as DocumentId,
			profile,
		});

		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error('Expected ok');

		expect(result.snapshot.mode).toBe('document_preview');
		expect(result.snapshot.mainPanel.kind).toBe('document_preview');
	});

	it('stores the materialized draft in the returned state', () => {
		const profile = testProfile();
		const state = partialState();

		const result = openDocumentPreviewUseCase(state, {
			documentId: 'doc-1' as DocumentId,
			profile,
		});

		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error('Expected ok');

		const docState = result.state.documentStates['doc-1' as DocumentId];
		expect(docState).toBeDefined();
		expect(docState?.draft).not.toBeNull();
		expect(docState?.draft?.format).toBe('markdown');
		// Content should include sections from accepted nodes
		expect(docState?.draft?.content).toContain('Test Document');
	});

	it('export is disabled when required sections are missing', () => {
		const profile = testProfile();
		const state = partialState();

		const result = openDocumentPreviewUseCase(state, {
			documentId: 'doc-1' as DocumentId,
			profile,
		});

		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error('Expected ok');

		expect(result.snapshot.mainPanel.kind).toBe('document_preview');
		if (result.snapshot.mainPanel.kind !== 'document_preview') {
			throw new Error('Expected document_preview panel');
		}
		expect(result.snapshot.mainPanel.exportEligible).toBe(false);
	});

	it('export is enabled when all required sections are accepted and fresh', () => {
		const profile = testProfile();
		const state = fullyAcceptedState();

		const result = openDocumentPreviewUseCase(state, {
			documentId: 'doc-1' as DocumentId,
			profile,
		});

		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error('Expected ok');

		expect(result.snapshot.mainPanel.kind).toBe('document_preview');
		if (result.snapshot.mainPanel.kind !== 'document_preview') {
			throw new Error('Expected document_preview panel');
		}
		expect(result.snapshot.mainPanel.exportEligible).toBe(true);
	});

	it('saves correct export eligibility into returned state', () => {
		const profile = testProfile();
		const state = fullyAcceptedState();

		const result = openDocumentPreviewUseCase(state, {
			documentId: 'doc-1' as DocumentId,
			profile,
		});

		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error('Expected ok');

		const docState = result.state.documentStates['doc-1' as DocumentId];
		expect(docState).toBeDefined();
		expect(docState?.draft?.stale).toBe(false);
		expect(docState?.missingRequiredNodeIds).toEqual([]);
		expect(docState?.status).toBe('drafted');
	});

	it('returns error when no document can be resolved', () => {
		const profile = testProfile();
		const state: LogosRuntimeState = {
			...partialState(),
			activeNodeId: null,
		};

		const result = openDocumentPreviewUseCase(state, { profile });

		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('Expected failure');
		expect(result.error).toContain('No document to preview');
	});

	it('active node with no parent document returns error', () => {
		const profile = testProfile();
		// Create a state where activeNodeId points to a node not in the profile
		const state: LogosRuntimeState = {
			...partialState(),
			activeNodeId: 'unknown-node' as NodeId,
		};

		const result = openDocumentPreviewUseCase(state, { profile });

		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('Expected failure');
		expect(result.error).toContain('No document to preview');
	});
});
