/**
 * Tests for Step 4.1 — message management for node conversations.
 *
 * Covers:
 *  - `appendUserMessage` — appends with role "user", timestamp, unique ID,
 *    updates `lastUserMessageId`.
 *  - `appendAssistantMessage` — appends with metadata, metadata preserved,
 *    updates `lastAssistantMessageId`.
 *  - `appendSystemMessage` — appends system message, does not update
 *    user/assistant ID trackers.
 *  - `appendUserMessage` to non-active node → error.
 *  - `appendAssistantMessage` without required metadata → error.
 *  - `getConversation` — returns messages in chronological order.
 *  - `getRecentMessages(limit)` — returns last N messages.
 *  - Message IDs are unique and lexicographically sortable.
 *  - Immutability: input state is never mutated.
 */
import { describe, expect, it } from 'vitest';

import type {
	LogosRuntimeState,
	NodeMessageMetadata,
	PromptState,
} from '../../src/contracts/index.js';
import type { NodeId, SessionId } from '../../src/shared/index.js';
import { generateId } from '../../src/shared/index.js';
import {
	appendAssistantMessage,
	appendSystemMessage,
	appendUserMessage,
	getConversation,
	getRecentMessages,
} from '../../src/conversation-runtime/index.js';

// ═══════════════════════════════════════════════════════════════════════════
// Test helpers
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create a minimal `LogosRuntimeState` in `node_focus` mode with one
 * node (`"n1"`) already initialized.
 *
 * The node starts in `active` lifecycle with an empty conversation.
 */
function nodeFocusState(): LogosRuntimeState {
	const sessionId = generateId() as SessionId;
	const n1: NodeId = 'n1' as NodeId;

	return {
		activeNodeId: n1,
		documentStates: {},
		exportState: { artifacts: [] },
		globalContext: {
			preferences: {},
			projectName: null,
			summary: null,
		},
		lastActiveNodeId: null,
		mode: 'node_focus',
		nodeStates: {
			[n1]: {
				allowedActions: ['answer', 'defer', 'mark_as_assumption', 'mark_as_decision'],
				canonicalAnswer: null,
				completeness: {
					blockingIssues: [],
					complete: false,
					coverage: {},
					missing: [],
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
					openQuestions: [],
					risks: [],
				},
				lifecycle: 'active',
				nodeId: n1,
				promptState: 'follow_up',
				updatedAt: new Date().toISOString(),
			},
		},
		selectedProfileId: 'test-profile' as import('../../src/shared/index.js').ProfileId,
		sessionId,
		updatedAt: new Date().toISOString(),
	};
}

/** Deep-clone a state object for immutability assertions. */
function cloneState(s: LogosRuntimeState): LogosRuntimeState {
	return JSON.parse(JSON.stringify(s));
}

/** Shorthand for the test node ID. */
const N1: NodeId = 'n1' as NodeId;

// ═══════════════════════════════════════════════════════════════════════════
// appendUserMessage
// ═══════════════════════════════════════════════════════════════════════════

describe('appendUserMessage', () => {
	it('appends a user message to the active node conversation', () => {
		const state = nodeFocusState();
		const original = cloneState(state);

		const result = appendUserMessage(state, N1, 'What is the central thesis?');

		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error('Expected ok');

		const nodeState = result.state.nodeStates[N1];
		expect(nodeState).toBeDefined();
		expect(nodeState?.conversation.length).toBe(1);

		const msg = nodeState?.conversation[0];
		expect(msg?.role).toBe('user');
		expect(msg?.content).toBe('What is the central thesis?');
		expect(msg?.id).toBeTypeOf('string');
		expect(msg?.createdAt).toBeTypeOf('string');
		// ISO-8601 timestamp
		expect(msg?.createdAt).toMatch(
			/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
		);

		// Input state not mutated
		expect(state).toEqual(original);
		expect(state.nodeStates[N1]?.conversation.length).toBe(0);
	});

	it('updates lastUserMessageId on append', () => {
		const state = nodeFocusState();

		const result = appendUserMessage(state, N1, 'Hello');

		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error('Expected ok');

		const msg = result.state.nodeStates[N1]?.conversation[0];
		expect(msg).toBeDefined();
		expect(result.state.nodeStates[N1]?.lastUserMessageId).toBe(msg?.id);
	});

	it('does not update lastAssistantMessageId', () => {
		const state = nodeFocusState();

		const result = appendUserMessage(state, N1, 'Hello');

		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error('Expected ok');

		expect(result.state.nodeStates[N1]?.lastAssistantMessageId).toBeUndefined();
	});

	it('rejects append to non-active node (different nodeId)', () => {
		const state = nodeFocusState();

		const result = appendUserMessage(state, 'other-node' as NodeId, 'Hello');

		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('Expected error');

		expect(result.error).toContain('not the active node');
	});

	it('rejects append when session is not in node_focus mode', () => {
		const state: LogosRuntimeState = {
			...nodeFocusState(),
			activeNodeId: null,
			mode: 'structure_overview',
		};

		const result = appendUserMessage(state, N1, 'Hello');

		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('Expected error');

		expect(result.error).toContain('not "node_focus"');
	});

	it('rejects append when node is not in nodeStates', () => {
		const state: LogosRuntimeState = {
			...nodeFocusState(),
			nodeStates: {},
		};

		const result = appendUserMessage(state, N1, 'Hello');

		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('Expected error');

		expect(result.error).toContain('has no runtime state');
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// appendAssistantMessage
// ═══════════════════════════════════════════════════════════════════════════

describe('appendAssistantMessage', () => {
	it('appends an assistant message with metadata', () => {
		const state = nodeFocusState();

		const metadata: NodeMessageMetadata = {
			model: 'claude-sonnet-4-20250514',
			promptId: 'prompt-001' as import('../../src/shared/index.js').PromptId,
			promptState: 'follow_up' as PromptState,
			stateAfter: 'active',
			stateBefore: 'active',
			structuredOutputId: 'out-001',
		};

		const result = appendAssistantMessage(
			state,
			N1,
			'The central thesis appears to be about distributed systems.',
			metadata,
		);

		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error('Expected ok');

		const nodeState = result.state.nodeStates[N1];
		expect(nodeState?.conversation.length).toBe(1);

		const msg = nodeState?.conversation[0];
		expect(msg?.role).toBe('assistant');
		expect(msg?.content).toBe(
			'The central thesis appears to be about distributed systems.',
		);
		expect(msg?.id).toBeTypeOf('string');
		expect(msg?.createdAt).toBeTypeOf('string');

		// Metadata preserved exactly
		expect(msg?.metadata).toEqual(metadata);
	});

	it('updates lastAssistantMessageId on append', () => {
		const state = nodeFocusState();

		const metadata: NodeMessageMetadata = {
			promptId: 'prompt-001' as import('../../src/shared/index.js').PromptId,
			promptState: 'follow_up' as PromptState,
			structuredOutputId: 'out-001',
		};

		const result = appendAssistantMessage(state, N1, 'Response.', metadata);

		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error('Expected ok');

		const msg = result.state.nodeStates[N1]?.conversation[0];
		expect(result.state.nodeStates[N1]?.lastAssistantMessageId).toBe(msg?.id);
	});

	it('does not update lastUserMessageId', () => {
		const state = nodeFocusState();

		const metadata: NodeMessageMetadata = {
			promptId: 'prompt-001' as import('../../src/shared/index.js').PromptId,
			promptState: 'follow_up' as PromptState,
			structuredOutputId: 'out-001',
		};

		const result = appendAssistantMessage(state, N1, 'Response.', metadata);

		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error('Expected ok');

		expect(result.state.nodeStates[N1]?.lastUserMessageId).toBeUndefined();
	});

	it('rejects append when promptId is missing', () => {
		const state = nodeFocusState();

		const result = appendAssistantMessage(state, N1, 'Response.', {
			promptState: 'follow_up' as PromptState,
			structuredOutputId: 'out-001',
		});

		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('Expected error');

		expect(result.error).toContain('promptId');
	});

	it('rejects append when promptState is missing', () => {
		const state = nodeFocusState();

		const result = appendAssistantMessage(state, N1, 'Response.', {
			promptId: 'prompt-001' as import('../../src/shared/index.js').PromptId,
			structuredOutputId: 'out-001',
		});

		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('Expected error');

		expect(result.error).toContain('promptState');
	});

	it('rejects append when structuredOutputId is missing', () => {
		const state = nodeFocusState();

		const result = appendAssistantMessage(state, N1, 'Response.', {
			promptId: 'prompt-001' as import('../../src/shared/index.js').PromptId,
			promptState: 'follow_up' as PromptState,
		});

		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('Expected error');

		expect(result.error).toContain('structuredOutputId');
	});

	it('rejects append when promptId is empty string', () => {
		const state = nodeFocusState();

		const result = appendAssistantMessage(state, N1, 'Response.', {
			promptId: '' as import('../../src/shared/index.js').PromptId,
			promptState: 'follow_up' as PromptState,
			structuredOutputId: 'out-001',
		});

		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('Expected error');

		expect(result.error).toContain('promptId');
	});

	it('rejects append to non-active node', () => {
		const state = nodeFocusState();

		const metadata: NodeMessageMetadata = {
			promptId: 'prompt-001' as import('../../src/shared/index.js').PromptId,
			promptState: 'follow_up' as PromptState,
			structuredOutputId: 'out-001',
		};

		const result = appendAssistantMessage(
			state,
			'other-node' as NodeId,
			'Response.',
			metadata,
		);

		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('Expected error');

		expect(result.error).toContain('not the active node');
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// appendSystemMessage
// ═══════════════════════════════════════════════════════════════════════════

describe('appendSystemMessage', () => {
	it('appends a system message with correct role', () => {
		const state = nodeFocusState();

		const result = appendSystemMessage(state, N1, 'Internal note: context updated.');

		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error('Expected ok');

		const nodeState = result.state.nodeStates[N1];
		expect(nodeState?.conversation.length).toBe(1);

		const msg = nodeState?.conversation[0];
		expect(msg?.role).toBe('system');
		expect(msg?.content).toBe('Internal note: context updated.');
		expect(msg?.id).toBeTypeOf('string');
	});

	it('does not update lastUserMessageId or lastAssistantMessageId', () => {
		const state = nodeFocusState();

		const result = appendSystemMessage(state, N1, 'System note.');

		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error('Expected ok');

		expect(result.state.nodeStates[N1]?.lastUserMessageId).toBeUndefined();
		expect(result.state.nodeStates[N1]?.lastAssistantMessageId).toBeUndefined();
	});

	it('rejects append to non-active node', () => {
		const state = nodeFocusState();

		const result = appendSystemMessage(state, 'other-node' as NodeId, 'Note.');

		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('Expected error');
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// getConversation
// ═══════════════════════════════════════════════════════════════════════════

describe('getConversation', () => {
	it('returns messages in chronological order', () => {
		const state = nodeFocusState();

		// Append messages in a specific order
		const r1 = appendUserMessage(state, N1, 'First message')!;
		if (!r1.ok) throw new Error('Expected ok');

		const r2 = appendAssistantMessage(r1.state, N1, 'Assistant response 1', {
			promptId: 'prompt-001' as import('../../src/shared/index.js').PromptId,
			promptState: 'follow_up' as PromptState,
			structuredOutputId: 'out-001',
		})!;
		if (!r2.ok) throw new Error('Expected ok');

		const r3 = appendUserMessage(r2.state, N1, 'Second message')!;
		if (!r3.ok) throw new Error('Expected ok');

		const r4 = appendAssistantMessage(r3.state, N1, 'Assistant response 2', {
			promptId: 'prompt-002' as import('../../src/shared/index.js').PromptId,
			promptState: 'follow_up' as PromptState,
			structuredOutputId: 'out-002',
		})!;
		if (!r4.ok) throw new Error('Expected ok');

		const conversation = getConversation(r4.state, N1);

		expect(conversation.length).toBe(4);
		expect(conversation[0]?.content).toBe('First message');
		expect(conversation[1]?.content).toBe('Assistant response 1');
		expect(conversation[2]?.content).toBe('Second message');
		expect(conversation[3]?.content).toBe('Assistant response 2');
	});

	it('returns [] for a missing node', () => {
		const state = nodeFocusState();

		const conversation = getConversation(state, 'nonexistent' as NodeId);

		expect(conversation).toEqual([]);
	});

	it('returns a new array (does not expose internal reference)', () => {
		const state = nodeFocusState();

		const r1 = appendUserMessage(state, N1, 'Hello');
		if (!r1.ok) throw new Error('Expected ok');

		const conversation = getConversation(r1.state, N1);
		conversation.pop();

		// Original state unchanged
		expect(r1.state.nodeStates[N1]?.conversation.length).toBe(1);
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// getRecentMessages
// ═══════════════════════════════════════════════════════════════════════════

describe('getRecentMessages', () => {
	it('returns last N messages (limit: 3)', () => {
		const state = nodeFocusState();

		// Append 5 user messages
		let s = state;
		for (let i = 1; i <= 5; i++) {
			const r = appendUserMessage(s, N1, `Message ${i}`);
			if (!r.ok) throw new Error('Expected ok');
			s = r.state;
		}

		const recent = getRecentMessages(s, N1, 3);

		expect(recent.length).toBe(3);
		expect(recent[0]?.content).toBe('Message 3');
		expect(recent[1]?.content).toBe('Message 4');
		expect(recent[2]?.content).toBe('Message 5');
	});

	it('returns all messages when limit exceeds count', () => {
		const state = nodeFocusState();

		let s = state;
		const r = appendUserMessage(s, N1, 'Only');
		if (!r.ok) throw new Error('Expected ok');
		s = r.state;

		const recent = getRecentMessages(s, N1, 10);

		expect(recent.length).toBe(1);
		expect(recent[0]?.content).toBe('Only');
	});

	it('returns [] when limit <= 0', () => {
		const state = nodeFocusState();

		let s = state;
		const r = appendUserMessage(s, N1, 'Hello');
		if (!r.ok) throw new Error('Expected ok');
		s = r.state;

		expect(getRecentMessages(s, N1, 0)).toEqual([]);
		expect(getRecentMessages(s, N1, -1)).toEqual([]);
	});

	it('returns [] for missing node', () => {
		const state = nodeFocusState();

		expect(getRecentMessages(state, 'nonexistent' as NodeId, 5)).toEqual([]);
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// Message ID uniqueness and sortability
// ═══════════════════════════════════════════════════════════════════════════

describe('message IDs', () => {
	it('are unique across multiple appends', () => {
		const state = nodeFocusState();

		let s = state;
		const ids = new Set<string>();

		for (let i = 0; i < 20; i++) {
			const r = appendUserMessage(s, N1, `Message ${i}`);
			if (!r.ok) throw new Error('Expected ok');

			const msg = r.state.nodeStates[N1]?.conversation[i];
			expect(msg).toBeDefined();
			ids.add(msg!.id);
			s = r.state;
		}

		expect(ids.size).toBe(20);
	});

	it('are lexicographically sortable (generation order = sort order)', () => {
		const state = nodeFocusState();

		let s = state;
		const ids: string[] = [];

		for (let i = 0; i < 10; i++) {
			const r = appendUserMessage(s, N1, `Message ${i}`);
			if (!r.ok) throw new Error('Expected ok');

			const msg = r.state.nodeStates[N1]?.conversation[i];
			ids.push(msg!.id);
			s = r.state;
		}

		// Lexicographic sort should match chronological generation order
		const sorted = [...ids].sort((a, b) => a.localeCompare(b));
		expect(sorted).toEqual(ids);
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// Immutability
// ═══════════════════════════════════════════════════════════════════════════

describe('immutability', () => {
	it('appendUserMessage does not mutate input state', () => {
		const state = nodeFocusState();
		const original = cloneState(state);

		appendUserMessage(state, N1, 'Hello');

		expect(state).toEqual(original);
	});

	it('appendAssistantMessage does not mutate input state', () => {
		const state = nodeFocusState();
		const original = cloneState(state);

		appendAssistantMessage(state, N1, 'Response.', {
			promptId: 'prompt-001' as import('../../src/shared/index.js').PromptId,
			promptState: 'follow_up' as PromptState,
			structuredOutputId: 'out-001',
		});

		expect(state).toEqual(original);
	});

	it('appendSystemMessage does not mutate input state', () => {
		const state = nodeFocusState();
		const original = cloneState(state);

		appendSystemMessage(state, N1, 'Internal note.');

		expect(state).toEqual(original);
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// Integration: appendUserMessage + appendAssistantMessage + query
// ═══════════════════════════════════════════════════════════════════════════

describe('integration', () => {
	it('tracks lastUserMessageId and lastAssistantMessageId through a full turn', () => {
		const state = nodeFocusState();

		// User sends a message
		const r1 = appendUserMessage(state, N1, 'What is the thesis?');
		if (!r1.ok) throw new Error('Expected ok');
		const userMsg = r1.state.nodeStates[N1]?.conversation[0];
		expect(r1.state.nodeStates[N1]?.lastUserMessageId).toBe(userMsg?.id);
		expect(r1.state.nodeStates[N1]?.lastAssistantMessageId).toBeUndefined();

		// Assistant responds
		const r2 = appendAssistantMessage(r1.state, N1, 'The thesis is about distributed systems.', {
			promptId: 'prompt-001' as import('../../src/shared/index.js').PromptId,
			promptState: 'follow_up' as PromptState,
			structuredOutputId: 'out-001',
		});
		if (!r2.ok) throw new Error('Expected ok');
		const asstMsg = r2.state.nodeStates[N1]?.conversation[1];

		// Both trackers should now be set to their respective messages
		expect(r2.state.nodeStates[N1]?.lastUserMessageId).toBe(userMsg?.id);
		expect(r2.state.nodeStates[N1]?.lastAssistantMessageId).toBe(asstMsg?.id);
	});
});
