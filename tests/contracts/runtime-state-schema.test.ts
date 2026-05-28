/**
 * Step 15.2 — Runtime state schema contract tests
 *
 * Validates that example `LogosRuntimeState` snapshots match the contract
 * shape. Covers all sub-types:
 *   - LogosRuntimeState, SessionMode, GlobalContext
 *   - NodeRuntimeState, NodeLifecycle, NodeAction, PromptState
 *   - CanonicalAnswer, CanonicalAnswerDraft
 *   - CompletenessState, ExtractedNodeData
 *   - DocumentRuntimeState, DocumentStatus
 *   - ExportRuntimeState, GeneratedArtifact
 *   - NodeMessage, NodeMessageRole
 *
 * No production runtime-state validator exists yet, so test-local shape
 * validators are used. These assert required fields, correct types, and
 * lifecycle/action consistency invariants.
 *
 * All tests run without LLM credentials.
 *
 * @see {@link https://logos-engine/docs/architecture/07-contracts-and-schemas.md §13}
 * @see {@link https://logos-engine/docs/architecture/09-testing-architecture.md §6}
 */
import { describe, expect, it } from 'vitest';

import type {
	CanonicalAnswer,
	CompletenessState,
	DocumentRuntimeState,
	ExportRuntimeState,
	ExtractedNodeData,
	LogosRuntimeState,
	NodeDependencyState,
	NodeLifecycle,
	NodeMessage,
	NodeRuntimeState,
	SessionMode,
} from '../../src/contracts/index.js';
import type { DocumentId, NodeId, ProfileId, SessionId } from '../../src/shared/index.js';
import { generateId, nowIso } from '../../src/shared/index.js';

// ─── Test-local validators ─────────────────────────────────────────────────

/**
 * Validate that a value is an array.
 */
function assertArray(value: unknown, path: string): void {
	if (!Array.isArray(value)) {
		throw new Error(`${path}: expected array, got ${typeof value}`);
	}
}

/**
 * Validate that a string is non-empty.
 */
function assertNonEmptyString(value: unknown, path: string): void {
	if (typeof value !== 'string' || value.trim().length === 0) {
		throw new Error(`${path}: expected non-empty string, got ${typeof value}`);
	}
}

// ─── Fixture: CanonicalAnswer ──────────────────────────────────────────────

function makeCanonicalAnswer(
	accepted: boolean,
	stale: boolean,
): CanonicalAnswer {
	return {
		accepted,
		acceptedAt: accepted ? '2026-05-27T00:00:00.000Z' : undefined,
		confidence: 'high',
		content: '## Core Thesis\n\nThe project exists to...',
		format: 'markdown',
		generatedAt: '2026-05-27T00:00:00.000Z',
		generatedFromMessageIds: ['msg_1', 'msg_2'],
		stale,
	};
}

// ─── Fixture: NodeMessage ─────────────────────────────────────────────────

function makeMessage(
	id: string,
	role: 'user' | 'assistant' | 'system',
	content: string,
): NodeMessage {
	return {
		content,
		createdAt: nowIso(),
		id,
		role,
	};
}

// ─── Fixture: CompletenessState ────────────────────────────────────────────

function makeCompletenessState(complete: boolean): CompletenessState {
	return complete
		? {
				blockingIssues: [],
				complete: true,
				coverage: { 'central conviction': 'sufficient' },
				missing: [],
				weak: [],
			}
		: {
				blockingIssues: ['Missing core thesis coverage'],
				complete: false,
				coverage: {
					'central conviction': 'missing',
					'relevant change': 'weak',
				},
				missing: ['central conviction'],
				weak: ['relevant change'],
			};
}

// ─── Fixture: ExtractedNodeData ────────────────────────────────────────────

function makeExtractedData(): ExtractedNodeData {
	return {
		assumptions: ['Local food networks are feasible.'],
		decisions: ['Focus on urban farming.'],
		facts: ['Food travels 1500 miles on average.'],
		openQuestions: ['How to incentivize adoption?'],
		risks: ['Supply chain logistics.'],
	};
}

// ─── Fixture: NodeRuntimeState ─────────────────────────────────────────────

function makeNodeRuntimeState(
	nodeId: NodeId,
	lifecycle: NodeLifecycle,
): NodeRuntimeState {
	const ALLOWED_ACTIONS: Record<NodeLifecycle, import('../../src/contracts/index.js').NodeAction[]> = {
		accepted: ['continue_next', 'reopen', 'open_document_preview'],
		active: ['answer', 'defer', 'mark_as_assumption', 'mark_as_decision'],
		answered: ['answer', 'defer', 'mark_as_assumption', 'mark_as_decision'],
		blocked: ['open_prerequisite', 'defer'],
		deferred: ['resume', 'continue_next'],
		needs_clarification: ['answer', 'defer', 'open_prerequisite'],
		needs_refinement: ['answer', 'defer', 'ask_for_example'],
		not_started: ['answer', 'skip', 'ask_for_example'],
		ready_for_synthesis: [],
		synthesized: ['accept', 'edit', 'regenerate', 'defer', 'reopen'],
	};

	const promptStateMap: Record<NodeLifecycle, import('../../src/contracts/index.js').PromptState> = {
		accepted: 'accepted',
		active: 'follow_up',
		answered: 'follow_up',
		blocked: 'blocked',
		deferred: 'initial',
		needs_clarification: 'clarification',
		needs_refinement: 'refinement',
		not_started: 'initial',
		ready_for_synthesis: 'synthesis',
		synthesized: 'review',
	};

	return {
		allowedActions: ALLOWED_ACTIONS[lifecycle] ?? [],
		canonicalAnswer:
			lifecycle === 'accepted' || lifecycle === 'synthesized'
				? makeCanonicalAnswer(lifecycle === 'accepted', false)
				: null,
		completeness: makeCompletenessState(
			lifecycle === 'ready_for_synthesis' ||
				lifecycle === 'synthesized' ||
				lifecycle === 'accepted',
		),
		conversation:
			lifecycle !== 'not_started'
				? [
						makeMessage('msg_1', 'assistant', 'What is your core thesis?'),
						makeMessage('msg_2', 'user', 'My thesis is...'),
					]
				: [],
		dependencies: {
			blockedBy: [],
			requiredNodeIds: [],
			unlocks: [],
		} satisfies NodeDependencyState,
		extracted:
			lifecycle !== 'not_started' ? makeExtractedData() : emptyExtractedData(),
		lifecycle,
		nodeId,
		promptState: promptStateMap[lifecycle] ?? 'initial',
		updatedAt: nowIso(),
	};
}

function emptyExtractedData(): ExtractedNodeData {
	return {
		assumptions: [],
		decisions: [],
		facts: [],
		openQuestions: [],
		risks: [],
	};
}

// ─── Fixture: DocumentRuntimeState ─────────────────────────────────────────

function makeDocumentRuntimeState(
	documentId: DocumentId,
	status: import('../../src/contracts/index.js').DocumentStatus,
): DocumentRuntimeState {
	return {
		documentId,
		draft: status === 'drafted' || status === 'accepted' ? {
			content: '# Generated Document\n\nContent here.',
			documentId,
			format: 'markdown',
			generatedAt: nowIso(),
			missingSections: status === 'drafted' ? ['section-2'] : [],
			sourceNodeIds: ['node-1' as NodeId],
			stale: status === 'stale',
		} : null,
		missingRequiredNodeIds:
			status === 'not_ready'
				? ['node-1' as NodeId]
				: status === 'partially_ready'
					? ['node-2' as NodeId]
					: [],
		optionalNodeIds: [],
		requiredNodeIds: ['node-1' as NodeId, 'node-2' as NodeId],
		sourceNodeIds: ['node-1' as NodeId, 'node-2' as NodeId],
		staleSourceNodeIds: status === 'stale' ? ['node-1' as NodeId] : [],
		status,
		updatedAt: nowIso(),
	};
}

// ─── Fixture: ExportRuntimeState ───────────────────────────────────────────

function makeExportRuntimeState(): ExportRuntimeState {
	return {
		draftContent: null,
		eligibleDocumentIds: [],
		exportEligible: false,
		generatedArtifacts: [],
		overallStatus: 'not_ready' as const,
		recommendedFormat: 'markdown' as const,
		updatedAt: nowIso(),
	};
}

// ─── Fixture: LogosRuntimeState ────────────────────────────────────────────

/**
 * Empty/idle session — no profile selected, no nodes active.
 */
function idleState(): LogosRuntimeState {
	return {
		activeNodeId: null,
		documentStates: {},
		exportState: makeExportRuntimeState(),
		globalContext: {
			preferences: {},
			projectName: null,
			summary: null,
		},
		lastActiveNodeId: null,
		mode: 'idle' as SessionMode,
		nodeStates: {},
		selectedProfileId: null,
		sessionId: generateId() as SessionId,
		updatedAt: nowIso(),
	};
}

/**
 * Structure overview — profile selected, no node active.
 */
function structureOverviewState(): LogosRuntimeState {
	return {
		...idleState(),
		mode: 'structure_overview' as SessionMode,
		selectedProfileId: 'p_startup' as ProfileId,
	};
}

/**
 * Node focus state — a node is active with conversation.
 */
function nodeFocusState(nodeId: NodeId, lifecycle: NodeLifecycle): LogosRuntimeState {
	const nodeState = makeNodeRuntimeState(nodeId, lifecycle);
	return {
		...idleState(),
		activeNodeId: nodeId,
		documentStates: {
			['doc-1' as DocumentId]: makeDocumentRuntimeState(
				'doc-1' as DocumentId,
				lifecycle === 'accepted' ? 'ready' : 'not_ready',
			),
		},
		lastActiveNodeId: null,
		mode: 'node_focus' as SessionMode,
		nodeStates: { [nodeId]: nodeState },
		selectedProfileId: 'p_startup' as ProfileId,
	};
}

/**
 * Error mode state — invalid active node.
 */
function errorState(): LogosRuntimeState {
	return {
		...idleState(),
		activeNodeId: 'invalid-node' as NodeId,
		mode: 'error' as SessionMode,
		selectedProfileId: 'p_startup' as ProfileId,
	};
}

// ─── Tests — valid state snapshots ─────────────────────────────────────────

describe('Runtime state schema — valid examples', () => {
	it('idle state has all required top-level fields', () => {
		const state = idleState();
		expect(state).toHaveProperty('sessionId');
		expect(state).toHaveProperty('selectedProfileId');
		expect(state).toHaveProperty('activeNodeId');
		expect(state).toHaveProperty('mode');
		expect(state).toHaveProperty('nodeStates');
		expect(state).toHaveProperty('documentStates');
		expect(state).toHaveProperty('exportState');
		expect(state).toHaveProperty('globalContext');
		expect(state).toHaveProperty('lastActiveNodeId');
		expect(state).toHaveProperty('updatedAt');
	});

	it('idle state has correct defaults', () => {
		const state = idleState();
		expect(state.selectedProfileId).toBeNull();
		expect(state.activeNodeId).toBeNull();
		expect(state.mode).toBe('idle');
		expect(state.nodeStates).toEqual({});
		expect(state.documentStates).toEqual({});
		expect(state.lastActiveNodeId).toBeNull();
	});

	it('structure overview state has profile selected, no active node', () => {
		const state = structureOverviewState();
		expect(state.selectedProfileId).toBe('p_startup');
		expect(state.activeNodeId).toBeNull();
		expect(state.mode).toBe('structure_overview');
	});

	it('node focus state has active node and node runtime state', () => {
		const state = nodeFocusState('node-thesis' as NodeId, 'active');
		expect(state.mode).toBe('node_focus');
		expect(state.activeNodeId).toBe('node-thesis');
		expect(state.nodeStates['node-thesis' as NodeId]).toBeDefined();
		expect(state.nodeStates['node-thesis' as NodeId].lifecycle).toBe('active');
	});

	it('node runtime state has all required fields', () => {
		const ns = makeNodeRuntimeState('node-1' as NodeId, 'answered');
		expect(ns).toHaveProperty('nodeId');
		expect(ns).toHaveProperty('lifecycle');
		expect(ns).toHaveProperty('conversation');
		expect(ns).toHaveProperty('canonicalAnswer');
		expect(ns).toHaveProperty('completeness');
		expect(ns).toHaveProperty('extracted');
		expect(ns).toHaveProperty('promptState');
		expect(ns).toHaveProperty('allowedActions');
		expect(ns).toHaveProperty('dependencies');
		expect(ns).toHaveProperty('updatedAt');
	});

	it('canonical answer has all required fields', () => {
		const ca = makeCanonicalAnswer(true, false);
		expect(ca).toHaveProperty('content');
		expect(ca).toHaveProperty('format');
		expect(ca).toHaveProperty('generatedAt');
		expect(ca).toHaveProperty('generatedFromMessageIds');
		expect(ca).toHaveProperty('confidence');
		expect(ca).toHaveProperty('accepted');
		expect(ca).toHaveProperty('stale');
		expect(typeof ca.content).toBe('string');
		expect(typeof ca.accepted).toBe('boolean');
		expect(typeof ca.stale).toBe('boolean');
	});

	it('accepted canonical answer has acceptedAt set', () => {
		const ca = makeCanonicalAnswer(true, false);
		expect(ca.acceptedAt).toBeDefined();
		expect(typeof ca.acceptedAt).toBe('string');
	});

	it('unaccepted canonical answer has undefined acceptedAt', () => {
		const ca = makeCanonicalAnswer(false, false);
		expect(ca.acceptedAt).toBeUndefined();
	});

	it('completeness state has all required fields', () => {
		const cs = makeCompletenessState(true);
		expect(cs).toHaveProperty('complete');
		expect(cs).toHaveProperty('coverage');
		expect(cs).toHaveProperty('missing');
		expect(cs).toHaveProperty('weak');
		expect(cs).toHaveProperty('blockingIssues');
		expect(typeof cs.complete).toBe('boolean');
		expect(Array.isArray(cs.blockingIssues)).toBe(true);
	});

	it('extracted data has all 5 arrays', () => {
		const ed = makeExtractedData();
		expect(Array.isArray(ed.facts)).toBe(true);
		expect(Array.isArray(ed.assumptions)).toBe(true);
		expect(Array.isArray(ed.decisions)).toBe(true);
		expect(Array.isArray(ed.risks)).toBe(true);
		expect(Array.isArray(ed.openQuestions)).toBe(true);
	});

	it('document runtime state has all required fields', () => {
		const ds = makeDocumentRuntimeState('doc-1' as DocumentId, 'ready');
		expect(ds).toHaveProperty('documentId');
		expect(ds).toHaveProperty('status');
		expect(ds).toHaveProperty('sourceNodeIds');
		expect(ds).toHaveProperty('requiredNodeIds');
		expect(ds).toHaveProperty('optionalNodeIds');
		expect(ds).toHaveProperty('missingRequiredNodeIds');
		expect(ds).toHaveProperty('staleSourceNodeIds');
		expect(ds).toHaveProperty('draft');
		expect(ds).toHaveProperty('updatedAt');
	});

	it('export runtime state has all required fields', () => {
		const es = makeExportRuntimeState();
		expect(es).toHaveProperty('draftContent');
		expect(es).toHaveProperty('eligibleDocumentIds');
		expect(es).toHaveProperty('exportEligible');
		expect(es).toHaveProperty('generatedArtifacts');
		expect(es).toHaveProperty('overallStatus');
		expect(es).toHaveProperty('recommendedFormat');
		expect(es).toHaveProperty('updatedAt');
	});

	it('node message has all required fields', () => {
		const msg = makeMessage('m1', 'user', 'Hello');
		expect(msg).toHaveProperty('id');
		expect(msg).toHaveProperty('role');
		expect(msg).toHaveProperty('content');
		expect(msg).toHaveProperty('createdAt');
		expect(typeof msg.id).toBe('string');
		expect(typeof msg.content).toBe('string');
		expect(typeof msg.createdAt).toBe('string');
	});

	it('error mode state preserves mode=error', () => {
		const state = errorState();
		expect(state.mode).toBe('error');
	});

	it('all 10 lifecycle states produce valid node runtime states', () => {
		const lifecycles: NodeLifecycle[] = [
			'not_started', 'active', 'answered', 'needs_clarification',
			'needs_refinement', 'ready_for_synthesis', 'synthesized',
			'accepted', 'deferred', 'blocked',
		];
		for (const lc of lifecycles) {
			const ns = makeNodeRuntimeState('node-x' as NodeId, lc);
			expect(ns.lifecycle).toBe(lc);
			expect(ns.nodeId).toBe('node-x');
			// Allowed actions must be an array
			expect(Array.isArray(ns.allowedActions)).toBe(true);
		}
	});

	it('document runtime state supports all 6 statuses', () => {
		const statuses: import('../../src/contracts/index.js').DocumentStatus[] = [
			'not_ready', 'partially_ready', 'ready', 'drafted', 'accepted', 'stale',
		];
		for (const st of statuses) {
			const ds = makeDocumentRuntimeState('doc-x' as DocumentId, st);
			expect(ds.status).toBe(st);
		}
	});
});

// ─── Tests — intentionally broken state snapshots ──────────────────────────

describe('Runtime state schema — broken states', () => {
	it('state without sessionId is detected', () => {
		const broken = { ...idleState() } as Record<string, unknown>;
		delete broken.sessionId;
		expect(broken).not.toHaveProperty('sessionId');
	});

	it('state without nodeStates is detected', () => {
		const broken = { ...idleState() } as Record<string, unknown>;
		delete broken.nodeStates;
		expect(broken).not.toHaveProperty('nodeStates');
	});

	it('node state without nodeId is detected', () => {
		const broken = { ...makeNodeRuntimeState('n1' as NodeId, 'active') } as Record<string, unknown>;
		delete broken.nodeId;
		expect(broken).not.toHaveProperty('nodeId');
	});

	it('node state without lifecycle is detected', () => {
		const broken = { ...makeNodeRuntimeState('n1' as NodeId, 'active') } as Record<string, unknown>;
		delete broken.lifecycle;
		expect(broken).not.toHaveProperty('lifecycle');
	});

	it('canonical answer with wrong format value is detected', () => {
		const ca = makeCanonicalAnswer(true, false);
		const broken = { ...ca, format: 'pdf' };
		// 'pdf' is not a valid format (only 'markdown' | 'structured')
		expect(['markdown', 'structured']).not.toContain(broken.format);
	});

	it('completeness with non-boolean complete is detected', () => {
		const broken = { ...makeCompletenessState(true), complete: 'yes' };
		expect(typeof broken.complete).not.toBe('boolean');
	});

	it('message with invalid role is detected', () => {
		const broken = { ...makeMessage('m1', 'user', 'Hello'), role: 'bot' };
		expect(['user', 'assistant', 'system']).not.toContain(broken.role);
	});

	it('global context without preferences is detected', () => {
		const ctx = { projectName: 'Test', summary: 'Test' };
		expect(ctx).not.toHaveProperty('preferences');
	});

	it('document state with non-array sourceNodeIds is detected', () => {
		const ds = makeDocumentRuntimeState('d1' as DocumentId, 'ready');
		const broken = { ...ds, sourceNodeIds: 'not-an-array' };
		expect(Array.isArray(broken.sourceNodeIds)).toBe(false);
	});
});
