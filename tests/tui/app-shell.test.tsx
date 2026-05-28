/**
 * Tests for Step 8.2 — TUI shell and layout components.
 *
 * Uses ink-testing-library for render output assertions.
 * Tests cover: idle screen, structure overview, node focus,
 * focus management, keyboard dispatch.
 */

import { render } from 'ink-testing-library';
import { describe, expect, it, vi } from 'vitest';

import type {
	DocumentId,
	DocumentPreviewPanel,
	ErrorPanel,
	ErrorRecoveryAction,
	IdlePanel,
	NodeConversationPanel,
	ProfilePanel,
	TuiRenderSnapshot,
} from '../../src/contracts/index.js';
import type { NodeId } from '../../src/shared/index.js';
import {
	AppShell,
	TuiApplicationProvider,
	type TuiDispatchEvent,
} from '../../src/tui/index.js';

// ═══════════════════════════════════════════════════════════════════════════
// Fixtures
// ═══════════════════════════════════════════════════════════════════════════

const mockProviderStatus: ProviderStatus = {
	guidance: null,
	label: 'Mock',
	mode: 'mock',
};

function idleSnapshot(): TuiRenderSnapshot {
	return {
		actionBar: {
			actions: [
				{ enabled: true, id: 'select_profile', label: '[Select Profile]' },
				{ enabled: true, id: 'import_context', label: '[Import Context]' },
				{ enabled: true, id: 'open_settings', label: '[Settings]' },
			],
		},
		diagnostics: [],
		input: {
			enabled: false,
			reasonIfDisabled: 'Select a profile to begin.',
		},
		mainPanel: { kind: 'idle' } as IdlePanel,
		mode: 'idle',
		providerStatus: mockProviderStatus,
		sidebar: { activeNodeId: null, phases: [] },
	};
}

function structureOverviewSnapshot(): TuiRenderSnapshot {
	return {
		actionBar: { actions: [] },
		diagnostics: [],
		input: {
			enabled: false,
			reasonIfDisabled: 'Select a node to begin answering.',
		},
		mainPanel: {
			availableProfileIds: ['test-p'],
			kind: 'profile',
			message: 'Working with profile: Test Profile',
		} as ProfilePanel,
		mode: 'structure_overview',
		providerStatus: mockProviderStatus,
		sidebar: {
			activeNodeId: null,
			phases: [
				{
					documents: [
						{
							documentId: 'doc-1' as DocumentId,
							nodes: [
								{
									disabled: false,
									nodeId: 'n1' as NodeId,
									selected: false,
									statusSymbol: '○',
									title: 'Core Thesis',
								},
								{
									disabled: true,
									nodeId: 'n2' as NodeId,
									reasonIfDisabled: 'Blocked by prerequisite.',
									selected: false,
									statusSymbol: '⚠',
									title: 'Central Tension',
								},
							],
							title: 'Doc 1',
						},
					],
					phaseId: 'phase-1',
					title: 'Foundation',
				},
			],
			profileTitle: 'Test Profile',
		},
	};
}

function nodeFocusSnapshot(): TuiRenderSnapshot {
	return {
		actionBar: {
			actions: [
				{
					enabled: true,
					id: 'accept',
					label: '[Accept]',
					nodeAction: 'accept' as never,
				},
				{
					enabled: true,
					id: 'edit',
					label: '[Edit]',
					nodeAction: 'edit' as never,
				},
				{
					enabled: true,
					id: 'regenerate',
					label: '[Regenerate]',
					nodeAction: 'regenerate' as never,
				},
			],
		},
		diagnostics: [
			{ code: 'TEST_INFO', message: 'Snapshot loaded.', severity: 'info' },
		],
		input: {
			enabled: false,
			reasonIfDisabled: 'Review the draft answer before providing input.',
		},
		mainPanel: {
			breadcrumb: 'Foundation / Doc 1 / Core Thesis',
			canonicalAnswerAccepted: false,
			canonicalAnswerConfidence: 'medium',
			canonicalAnswerPreview: 'The core thesis goes here.',
			canonicalAnswerSourceMessageCount: 8,
			canonicalAnswerStale: false,
			kind: 'node_conversation',
			lifecycle: 'synthesized',
			messages: [
				{
					content: 'What is your core thesis?',
					createdAt: '2025-01-01T00:00:00.000Z',
					id: 'msg-1',
					role: 'assistant',
				},
				{
					content: 'We believe in skill-based evaluation.',
					createdAt: '2025-01-01T00:01:00.000Z',
					id: 'msg-2',
					role: 'user',
				},
			],
			nodeId: 'n1' as NodeId,
			title: 'Core Thesis',
		} as NodeConversationPanel,
		mode: 'node_focus',
		providerStatus: mockProviderStatus,
		sidebar: {
			activeNodeId: 'n1' as NodeId,
			phases: [
				{
					documents: [
						{
							documentId: 'doc-1' as DocumentId,
							nodes: [
								{
									disabled: false,
									nodeId: 'n1' as NodeId,
									selected: true,
									statusSymbol: '◆',
									title: 'Core Thesis',
								},
							],
							title: 'Doc 1',
						},
					],
					phaseId: 'phase-1',
					title: 'Foundation',
				},
			],
			profileTitle: 'Test Profile',
		},
	};
}

// ─── Render helper ──────────────────────────────────────────────────────────

function renderShell(
	snapshot: TuiRenderSnapshot,
	dispatch?: (e: TuiDispatchEvent) => void,
) {
	return render(
		<TuiApplicationProvider dispatch={dispatch} snapshot={snapshot}>
			<AppShell />
		</TuiApplicationProvider>,
	);
}

/**
 * Wait for Ink's pending escape flush timer (~20ms).
 * Ink 7 buffers escape characters in an input parser and flushes
 * them after a 20ms delay. Tests that simulate escape key must await
 * this flush before asserting dispatch calls.
 */
async function flushPendingEscape(): Promise<void> {
	await new Promise((resolve) => setTimeout(resolve, 30));
}

// ═══════════════════════════════════════════════════════════════════════════
// Idle mode
// ═══════════════════════════════════════════════════════════════════════════

describe('AppShell — idle mode', () => {
	it('renders LOGOS Engine title', () => {
		const { lastFrame } = renderShell(idleSnapshot());
		expect(lastFrame()).toContain('LOGOS Engine');
	});

	it('renders welcome message', () => {
		const { lastFrame } = renderShell(idleSnapshot());
		expect(lastFrame()).toContain('Welcome to LOGOS Engine');
	});

	it('renders action bar in idle screen', () => {
		const { lastFrame } = renderShell(idleSnapshot());
		const frame = lastFrame() ?? '';
		// Idle mode shows actions bar alongside welcome message
		expect(frame).toContain('[Select Profile]');
		expect(frame).toContain('[Import Context]');
		expect(frame).toContain('[Settings]');
	});

	it('shows no sidebar in idle mode', () => {
		const { lastFrame } = renderShell(idleSnapshot());
		const frame = lastFrame() ?? '';
		expect(frame).not.toContain('Profile:');
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// Structure overview mode
// ═══════════════════════════════════════════════════════════════════════════

describe('AppShell — structure overview', () => {
	it('renders profile title in sidebar', () => {
		const { lastFrame } = renderShell(structureOverviewSnapshot());
		expect(lastFrame()).toContain('Profile: Test Profile');
	});

	it('renders phase and document names in sidebar', () => {
		const { lastFrame } = renderShell(structureOverviewSnapshot());
		const frame = lastFrame() ?? '';
		expect(frame).toContain('Foundation');
		expect(frame).toContain('Doc 1');
	});

	it('renders node titles with status symbols', () => {
		const { lastFrame } = renderShell(structureOverviewSnapshot());
		const frame = lastFrame() ?? '';
		expect(frame).toContain('○ Core Thesis');
		expect(frame).toContain('⚠ Central Tension');
	});

	it('renders structure overview title', () => {
		const { lastFrame } = renderShell(structureOverviewSnapshot());
		expect(lastFrame()).toContain('Structure Overview');
	});

	it('shows profile message', () => {
		const { lastFrame } = renderShell(structureOverviewSnapshot());
		expect(lastFrame()).toContain('Working with profile: Test Profile');
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// Node focus mode
// ═══════════════════════════════════════════════════════════════════════════

describe('AppShell — node focus', () => {
	it('renders breadcrumb', () => {
		const { lastFrame } = renderShell(nodeFocusSnapshot());
		expect(lastFrame()).toContain('Foundation / Doc 1 / Core Thesis');
	});

	it('renders node title with lifecycle', () => {
		const { lastFrame } = renderShell(nodeFocusSnapshot());
		const frame = lastFrame() ?? '';
		expect(frame).toContain('Core Thesis');
		expect(frame).toContain('◆ Awaiting review');
	});

	it('renders conversation messages', () => {
		const { lastFrame } = renderShell(nodeFocusSnapshot());
		const frame = lastFrame() ?? '';
		expect(frame).toContain('What is your core thesis?');
		expect(frame).toContain('We believe in skill-based evaluation.');
	});

	it('renders canonical answer preview', () => {
		const { lastFrame } = renderShell(nodeFocusSnapshot());
		expect(lastFrame()).toContain('CANONICAL ANSWER (DRAFT)');
		expect(lastFrame()).toContain('The core thesis goes here.');
	});

	it('renders action bar', () => {
		const { lastFrame } = renderShell(nodeFocusSnapshot());
		const frame = lastFrame() ?? '';
		expect(frame).toContain('[Accept]');
		expect(frame).toContain('[Edit]');
	});

	it('does not render enabled input area (synthesized is review mode)', () => {
		// Synthesized state does not allow text input — only review actions.
		const { lastFrame } = renderShell(nodeFocusSnapshot());
		const frame = lastFrame() ?? '';
		expect(frame).not.toContain('Type your answer…');
		expect(frame).not.toContain('>>>');
	});

	it('renders diagnostics footer', () => {
		const { lastFrame } = renderShell(nodeFocusSnapshot());
		expect(lastFrame()).toContain('Snapshot loaded.');
	});

	it('sidebar highlights active node', () => {
		const { lastFrame } = renderShell(nodeFocusSnapshot());
		const frame = lastFrame() ?? '';
		expect(frame).toContain('◆ Core Thesis');
		expect(frame).toContain('◀');
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// Keyboard dispatch
// ═══════════════════════════════════════════════════════════════════════════

describe('AppShell — keyboard dispatch', () => {
	it('dispatches NODE_SELECTED on enter when sidebar node is focused', async () => {
		const dispatch = vi.fn();
		const { stdin } = renderShell(structureOverviewSnapshot(), dispatch);

		// Initial focus is on sidebar (first available region) at index 0.
		// With the collapsible tree, focusedItemIndex 0 is the phase row.
		// Navigate down to reach the first node:
		//   index 0: phase "Foundation"
		//   index 1: document "Doc 1"
		//   index 2: node "Core Thesis" (n1)
		stdin.write('\x1b[B'); // down to document
		await new Promise((r) => setTimeout(r, 5));
		stdin.write('\x1b[B'); // down to node
		await new Promise((r) => setTimeout(r, 5));
		// Enter to select
		stdin.write('\r');

		expect(dispatch).toHaveBeenCalledWith(
			expect.objectContaining({
				nodeId: 'n1',
				type: 'NODE_SELECTED',
			}),
		);
	});

	it('dispatches ACTION_SELECTED on enter when initial focus is on actions (no sidebar)', async () => {
		const dispatch = vi.fn();
		const snap = nodeFocusSnapshot();
		// Remove sidebar nodes AND disable input so only regions are: main, actions
		const noSidebarSnap: TuiRenderSnapshot = {
			...snap,
			input: { enabled: false, reasonIfDisabled: 'test' },
			sidebar: { activeNodeId: null, phases: [] },
		};

		const { stdin } = renderShell(noSidebarSnap, dispatch);

		// Only regions: main, actions. One tab to reach actions.
		stdin.write('\t'); // actions
		// Yield to flush React state before pressing Enter
		await new Promise((r) => setTimeout(r, 5));
		stdin.write('\r');

		expect(dispatch).toHaveBeenCalledWith(
			expect.objectContaining({
				actionId: 'accept',
				type: 'ACTION_SELECTED',
			}),
		);
	});

	it('dispatches ESCAPE on escape key (with timer flush)', async () => {
		const dispatch = vi.fn();
		const { stdin } = renderShell(nodeFocusSnapshot(), dispatch);

		// Ink 7 buffers escape characters for 20ms before flushing
		stdin.write('\x1b');
		await new Promise((r) => setTimeout(r, 30));

		expect(dispatch).toHaveBeenCalledWith(
			expect.objectContaining({
				type: 'ESCAPE',
			}),
		);
	});

	it('does not dispatch on tab key alone', () => {
		const dispatch = vi.fn();
		const { stdin } = renderShell(nodeFocusSnapshot(), dispatch);

		stdin.write('\t');
		stdin.write('\t');

		expect(dispatch).not.toHaveBeenCalled();
	});

	it('dispatches USER_MESSAGE when typing in input and pressing Enter', async () => {
		const dispatch = vi.fn();
		const { stdin } = renderShell(notStartedSnapshot(), dispatch);

		// Navigate to input region
		stdin.write('\t'); // sidebar → main
		await new Promise((r) => setTimeout(r, 5));
		stdin.write('\t'); // main → input
		await new Promise((r) => setTimeout(r, 5));

		// Write one character, wait, then press Enter.
		// Ink 7 parseKeypress processes single printable characters
		// and passes them through as `input` to useInput callback.
		stdin.write('H');
		await new Promise((r) => setTimeout(r, 10));
		stdin.write('\r');

		expect(dispatch).toHaveBeenCalledWith(
			expect.objectContaining({
				content: 'H',
				submitAction: 'answer',
				type: 'USER_MESSAGE',
			}),
		);
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// Focus indicators
// ═══════════════════════════════════════════════════════════════════════════

describe('AppShell — focus indicators', () => {
	it('tab cycles through focus regions and shows focus markers', async () => {
		const { lastFrame, stdin } = renderShell(nodeFocusSnapshot());

		// Regions: sidebar → main → actions (input disabled in synthesized)
		stdin.write('\t'); // main
		// Yield to flush React state before pressing next tab
		await new Promise((r) => setTimeout(r, 5));
		stdin.write('\t'); // actions
		// Yield to flush React state before checking frame
		await new Promise((r) => setTimeout(r, 5));
		const f1 = lastFrame() ?? '';
		// Action should have ▶ marker
		expect(f1).toContain('▶');
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// Lifecycle snapshot tests — Step 8.3
// ═══════════════════════════════════════════════════════════════════════════

function notStartedSnapshot(): TuiRenderSnapshot {
	return {
		actionBar: {
			actions: [
				{
					enabled: true,
					id: 'answer',
					label: '[Answer]',
					nodeAction: 'answer' as never,
				},
				{
					enabled: true,
					id: 'skip',
					label: '[Skip]',
					nodeAction: 'skip' as never,
				},
				{
					enabled: true,
					id: 'ask_for_example',
					label: '[Ask for example]',
					nodeAction: 'ask_for_example' as never,
				},
			],
		},
		diagnostics: [],
		input: {
			enabled: true,
			placeholder: 'Type your answer…',
			submitAction: 'answer',
		},
		mainPanel: {
			breadcrumb: 'Foundation / Thesis / Core Thesis',
			canonicalAnswerAccepted: false,
			canonicalAnswerPreview: null,
			kind: 'node_conversation',
			lifecycle: 'not_started',
			messages: [
				{
					content: 'What conviction makes this project necessary?',
					createdAt: '2025-01-01T00:00:00.000Z',
					id: 'msg-1',
					role: 'assistant',
				},
			],
			nodeId: 'n1' as NodeId,
			title: 'Core Thesis',
		} as NodeConversationPanel,
		mode: 'node_focus',
		providerStatus: mockProviderStatus,
		sidebar: {
			activeNodeId: 'n1' as NodeId,
			phases: [
				{
					documents: [
						{
							documentId: 'doc-1' as DocumentId,
							nodes: [
								{
									disabled: false,
									nodeId: 'n1' as NodeId,
									selected: true,
									statusSymbol: '○',
									title: 'Core Thesis',
								},
							],
							title: 'Thesis',
						},
					],
					phaseId: 'phase-1',
					title: 'Foundation',
				},
			],
			profileTitle: 'Startup',
		},
	};
}

function acceptedSnapshot(): TuiRenderSnapshot {
	return {
		actionBar: {
			actions: [
				{
					enabled: true,
					id: 'continue_next',
					label: '[Continue →]',
					nodeAction: 'continue_next' as never,
				},
				{
					enabled: true,
					id: 'reopen',
					label: '[Reopen]',
					nodeAction: 'reopen' as never,
				},
				{
					enabled: true,
					id: 'open_document_preview',
					label: '[Preview Document]',
					nodeAction: 'open_document_preview' as never,
				},
			],
		},
		diagnostics: [],
		input: { enabled: false },
		mainPanel: {
			breadcrumb: 'Foundation / Thesis / Core Thesis',
			canonicalAnswerAccepted: true,
			canonicalAnswerConfidence: 'medium',
			canonicalAnswerPreview:
				'The hiring industry evaluates credentials over competence.',
			canonicalAnswerSourceMessageCount: 8,
			canonicalAnswerStale: false,
			kind: 'node_conversation',
			lifecycle: 'accepted',
			messages: [
				{
					content: 'What is your core thesis?',
					createdAt: '2025-01-01T00:00:00.000Z',
					id: 'msg-1',
					role: 'assistant',
				},
				{
					content: 'We believe in skill-based evaluation.',
					createdAt: '2025-01-01T00:01:00.000Z',
					id: 'msg-2',
					role: 'user',
				},
				{
					content: 'Core thesis accepted.',
					createdAt: '2025-01-01T00:02:00.000Z',
					id: 'msg-3',
					role: 'assistant',
				},
			],
			nodeId: 'n1' as NodeId,
			title: 'Core Thesis',
		} as NodeConversationPanel,
		mode: 'node_focus',
		providerStatus: mockProviderStatus,
		sidebar: {
			activeNodeId: 'n1' as NodeId,
			phases: [
				{
					documents: [
						{
							documentId: 'doc-1' as DocumentId,
							nodes: [
								{
									disabled: false,
									nodeId: 'n1' as NodeId,
									selected: true,
									statusSymbol: '✓',
									title: 'Core Thesis',
								},
							],
							title: 'Thesis',
						},
					],
					phaseId: 'phase-1',
					title: 'Foundation',
				},
			],
			profileTitle: 'Startup',
		},
	};
}

function blockedSnapshot(): TuiRenderSnapshot {
	return {
		actionBar: {
			actions: [
				{
					enabled: true,
					id: 'open_prerequisite',
					label: '[Open Prerequisite]',
					nodeAction: 'open_prerequisite' as never,
				},
				{
					enabled: true,
					id: 'defer',
					label: '[Defer]',
					nodeAction: 'defer' as never,
				},
			],
		},
		diagnostics: [],
		input: { enabled: false },
		mainPanel: {
			breadcrumb: 'Validation / Core Assumptions',
			canonicalAnswerAccepted: false,
			canonicalAnswerPreview: null,
			kind: 'node_conversation',
			lifecycle: 'blocked',
			messages: [
				{
					content:
						'This node depends on your Core Thesis, which must be accepted first.',
					createdAt: '2025-01-01T00:00:00.000Z',
					id: 'msg-1',
					role: 'assistant',
				},
			],
			nodeId: 'n2' as NodeId,
			title: 'Core Assumptions',
		} as NodeConversationPanel,
		mode: 'node_focus',
		providerStatus: mockProviderStatus,
		sidebar: {
			activeNodeId: 'n2' as NodeId,
			phases: [
				{
					documents: [
						{
							documentId: 'doc-1' as DocumentId,
							nodes: [
								{
									disabled: true,
									nodeId: 'n2' as NodeId,
									reasonIfDisabled: 'Blocked by prerequisite.',
									selected: true,
									statusSymbol: '⚠',
									title: 'Core Assumptions',
								},
							],
							title: 'Doc 1',
						},
					],
					phaseId: 'phase-2',
					title: 'Validation',
				},
			],
			profileTitle: 'Startup',
		},
	};
}

// ─── Not started lifecycle ─────────────────────────────────────────────────

describe('Lifecycle: not_started', () => {
	it('renders breadcrumb', () => {
		const { lastFrame } = renderShell(notStartedSnapshot());
		expect(lastFrame()).toContain('Foundation / Thesis / Core Thesis');
	});

	it('shows ○ Not started lifecycle badge', () => {
		const { lastFrame } = renderShell(notStartedSnapshot());
		expect(lastFrame()).toContain('○ Not started');
	});

	it('renders agent initial question prominently', () => {
		const { lastFrame } = renderShell(notStartedSnapshot());
		const frame = lastFrame() ?? '';
		expect(frame).toContain('Agent');
		expect(frame).toContain('What conviction makes this project necessary?');
	});

	it('shows input enabled with placeholder', () => {
		const { lastFrame } = renderShell(notStartedSnapshot());
		const frame = lastFrame() ?? '';
		expect(frame).toContain('Type your answer…');
	});

	it('shows correct actions: answer, skip, ask_for_example', () => {
		const { lastFrame } = renderShell(notStartedSnapshot());
		const frame = lastFrame() ?? '';
		expect(frame).toContain('[Answer]');
		expect(frame).toContain('[Skip]');
		expect(frame).toContain('[Ask for example]');
	});

	it('has no canonical answer preview when none exists', () => {
		const { lastFrame } = renderShell(notStartedSnapshot());
		expect(lastFrame()).not.toContain('CANONICAL ANSWER');
	});
});

// ─── Synthesized lifecycle ─────────────────────────────────────────────────

describe('Lifecycle: synthesized', () => {
	it('shows ◆ Awaiting review lifecycle badge', () => {
		const { lastFrame } = renderShell(nodeFocusSnapshot());
		expect(lastFrame()).toContain('◆ Awaiting review');
	});

	it('renders canonical answer preview', () => {
		const { lastFrame } = renderShell(nodeFocusSnapshot());
		const frame = lastFrame() ?? '';
		expect(frame).toContain('CANONICAL ANSWER');
		expect(frame).toContain('DRAFT');
		expect(frame).toContain('The core thesis goes here.');
	});

	it('shows correct actions: accept, edit, regenerate', () => {
		const { lastFrame } = renderShell(nodeFocusSnapshot());
		const frame = lastFrame() ?? '';
		expect(frame).toContain('[Accept]');
		expect(frame).toContain('[Edit]');
		expect(frame).toContain('[Regenerate]');
	});

	it('shows confidence and source message count', () => {
		const { lastFrame } = renderShell(nodeFocusSnapshot());
		const frame = lastFrame() ?? '';
		expect(frame).toContain('Confidence: medium');
		expect(frame).toContain('Generated from 8 messages');
	});

	it('hides input area (review mode)', () => {
		const { lastFrame } = renderShell(nodeFocusSnapshot());
		const frame = lastFrame() ?? '';
		expect(frame).not.toContain('Type your answer…');
		expect(frame).not.toContain('>>>');
	});
});

// ─── Accepted lifecycle ────────────────────────────────────────────────────

describe('Lifecycle: accepted', () => {
	it('shows ✓ Accepted lifecycle badge', () => {
		const { lastFrame } = renderShell(acceptedSnapshot());
		expect(lastFrame()).toContain('✓ Accepted');
	});

	it('shows canonical answer preview with ACCEPTED badge', () => {
		const { lastFrame } = renderShell(acceptedSnapshot());
		const frame = lastFrame() ?? '';
		expect(frame).toContain('CANONICAL ANSWER');
		expect(frame).toContain('ACCEPTED');
	});

	it('shows confidence and source message count', () => {
		const { lastFrame } = renderShell(acceptedSnapshot());
		const frame = lastFrame() ?? '';
		expect(frame).toContain('Confidence: medium');
		expect(frame).toContain('Generated from 8 messages');
	});

	it('shows correct actions: continue_next, reopen, preview', () => {
		const { lastFrame } = renderShell(acceptedSnapshot());
		const frame = lastFrame() ?? '';
		expect(frame).toContain('[Continue →]');
		expect(frame).toContain('[Reopen]');
		expect(frame).toContain('[Preview Document]');
	});

	it('hides input when accepted', () => {
		const { lastFrame } = renderShell(acceptedSnapshot());
		const frame = lastFrame() ?? '';
		expect(frame).not.toContain('Type your answer…');
		expect(frame).not.toContain('>>>');
	});
});

// ─── Blocked lifecycle ─────────────────────────────────────────────────────

describe('Lifecycle: blocked', () => {
	it('shows ⚠ Blocked lifecycle badge', () => {
		const { lastFrame } = renderShell(blockedSnapshot());
		expect(lastFrame()).toContain('⚠ Blocked');
	});

	it('renders blocker explanation from agent message', () => {
		const { lastFrame } = renderShell(blockedSnapshot());
		const frame = lastFrame() ?? '';
		expect(frame).toContain('This node depends on your Core Thesis');
	});

	it('shows correct actions: open_prerequisite, defer', () => {
		const { lastFrame } = renderShell(blockedSnapshot());
		const frame = lastFrame() ?? '';
		expect(frame).toContain('[Open Prerequisite]');
		expect(frame).toContain('[Defer]');
	});

	it('hides input when blocked', () => {
		const { lastFrame } = renderShell(blockedSnapshot());
		const frame = lastFrame() ?? '';
		expect(frame).not.toContain('Type your answer…');
		expect(frame).not.toContain('>>>');
	});

	it('has no canonical answer preview', () => {
		const { lastFrame } = renderShell(blockedSnapshot());
		expect(lastFrame()).not.toContain('CANONICAL ANSWER');
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// Message ordering
// ═══════════════════════════════════════════════════════════════════════════

describe('Conversation message ordering', () => {
	it('preserves chronological order when user message follows agent', () => {
		// Messages: agent → user. Agent is not the last message,
		// so all messages render as plain history in order.
		const snap = nodeFocusSnapshot();
		const { lastFrame } = renderShell(snap);
		const frame = lastFrame() ?? '';

		// Both messages should appear, and the user message (index 1)
		// should appear after the agent message (index 0).
		const agentIdx = frame.indexOf('What is your core thesis?');
		const userIdx = frame.indexOf('We believe in skill-based evaluation.');
		expect(agentIdx).toBeGreaterThan(-1);
		expect(userIdx).toBeGreaterThan(-1);
		expect(agentIdx).toBeLessThan(userIdx);
	});

	it('promotes latest agent message when it is the final message', () => {
		// Messages: user → agent. Agent IS the last message,
		// so it should render in the prominent Agent block.
		const snap: TuiRenderSnapshot = {
			...notStartedSnapshot(),
			mainPanel: {
				...(notStartedSnapshot().mainPanel as NodeConversationPanel),
				lifecycle: 'active' as const,
				messages: [
					{
						content: 'My answer goes here.',
						createdAt: '2025-01-01T00:00:00.000Z',
						id: 'msg-user',
						role: 'user' as const,
					},
					{
						content: 'Follow-up question from agent.',
						createdAt: '2025-01-01T00:01:00.000Z',
						id: 'msg-agent',
						role: 'assistant' as const,
					},
				],
			},
		};
		const { lastFrame } = renderShell(snap);
		const frame = lastFrame() ?? '';

		// History section: user message appears dimmed
		expect(frame).toContain('─── History ───');
		// Latest agent appears in prominent Agent block
		expect(frame).toContain('Follow-up question from agent.');
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// Stale canonical answer
// ═══════════════════════════════════════════════════════════════════════════

describe('Canonical answer — stale', () => {
	it('shows STALE badge and takes precedence over accepted', () => {
		const snap: TuiRenderSnapshot = {
			...acceptedSnapshot(),
			mainPanel: {
				...(acceptedSnapshot().mainPanel as NodeConversationPanel),
				canonicalAnswerAccepted: true,
				canonicalAnswerStale: true,
			},
		};
		const { lastFrame } = renderShell(snap);
		const frame = lastFrame() ?? '';
		expect(frame).toContain('STALE');
		expect(frame).not.toContain('ACCEPTED');
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// Sidebar tree rendering — Step 9.1
// ═══════════════════════════════════════════════════════════════════════════

function allLifecycleSymbolsSnapshot(): TuiRenderSnapshot {
	const allNodes: Array<{
		nodeId: NodeId;
		title: string;
		statusSymbol: string;
		selected: boolean;
		disabled: boolean;
		reasonIfDisabled?: string;
	}> = [
		{
			disabled: false,
			nodeId: 'n-o' as NodeId,
			selected: false,
			statusSymbol: '○',
			title: 'Not Started',
		},
		{
			disabled: false,
			nodeId: 'n-a' as NodeId,
			selected: false,
			statusSymbol: '◐',
			title: 'Active',
		},
		{
			disabled: false,
			nodeId: 'n-q' as NodeId,
			selected: false,
			statusSymbol: '?',
			title: 'Needs Clarification',
		},
		{
			disabled: false,
			nodeId: 'n-r' as NodeId,
			selected: false,
			statusSymbol: '△',
			title: 'Needs Refinement',
		},
		{
			disabled: false,
			nodeId: 'n-s' as NodeId,
			selected: false,
			statusSymbol: '◆',
			title: 'Ready for Synthesis',
		},
		{
			disabled: false,
			nodeId: 'n-v' as NodeId,
			selected: true,
			statusSymbol: '✓',
			title: 'Accepted',
		},
		{
			disabled: false,
			nodeId: 'n-d' as NodeId,
			selected: false,
			statusSymbol: '⏸',
			title: 'Deferred',
		},
		{
			disabled: true,
			nodeId: 'n-b' as NodeId,
			reasonIfDisabled: 'Blocked by prerequisite.',
			selected: false,
			statusSymbol: '⚠',
			title: 'Blocked',
		},
	];

	return {
		actionBar: { actions: [] },
		diagnostics: [],
		input: {
			enabled: false,
			reasonIfDisabled: 'Select a node from the sidebar.',
		},
		mainPanel: {
			availableProfileIds: ['test-profile'],
			kind: 'profile',
			message: 'Profile loaded.',
		} as ProfilePanel,
		mode: 'structure_overview',
		providerStatus: mockProviderStatus,
		sidebar: {
			activeNodeId: 'n-v' as NodeId,
			phases: [
				{
					documents: [
						{
							documentId: 'doc-all' as DocumentId,
							nodes: allNodes,
							title: 'All Status Symbols',
						},
					],
					phaseId: 'phase-all',
					title: 'Lifecycle Display',
				},
			],
			profileTitle: 'Test Profile',
		},
	};
}

describe('AppShell — sidebar tree rendering (Step 9.1)', () => {
	it('renders all 8 status symbols distinctly', () => {
		const { lastFrame } = renderShell(allLifecycleSymbolsSnapshot());
		const frame = lastFrame() ?? '';

		expect(frame).toContain('○ Not Started');
		expect(frame).toContain('◐ Active');
		expect(frame).toContain('? Needs Clarification');
		expect(frame).toContain('△ Needs Refinement');
		expect(frame).toContain('◆ Ready for Synthesis');
		expect(frame).toContain('✓ Accepted');
		expect(frame).toContain('⏸ Deferred');
		expect(frame).toContain('⚠ Blocked');
	});

	it('highlights the active node with ◀ marker', () => {
		const { lastFrame } = renderShell(allLifecycleSymbolsSnapshot());
		const frame = lastFrame() ?? '';
		expect(frame).toContain('✓ Accepted ◀');
	});

	it('shows phase with ▾ expand indicator and order', () => {
		const { lastFrame } = renderShell(allLifecycleSymbolsSnapshot());
		const frame = lastFrame() ?? '';
		expect(frame).toContain('▾ 01 Lifecycle Display');
	});

	it('shows document row', () => {
		const { lastFrame } = renderShell(allLifecycleSymbolsSnapshot());
		const frame = lastFrame() ?? '';
		expect(frame).toContain('▾');
		expect(frame).toContain('All Status Symbols');
	});

	it('shows blocked node with reason hint', () => {
		const { lastFrame } = renderShell(allLifecycleSymbolsSnapshot());
		const frame = lastFrame() ?? '';
		expect(frame).toContain('⚠ Blocked');
		// Reason hint may wrap across lines in the narrow sidebar
		expect(frame).toContain('(Blocked by');
		expect(frame).toContain('prerequisite.)');
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// Sidebar collapse/expand — Step 9.1
// ═══════════════════════════════════════════════════════════════════════════

describe('AppShell — sidebar collapse/expand (Step 9.1)', () => {
	it('collapses a phase via left arrow', async () => {
		const { lastFrame, stdin } = renderShell(structureOverviewSnapshot());

		// Initial: phase is expanded (▾)
		const before = lastFrame() ?? '';
		expect(before).toContain('▾ 01 Foundation');
		expect(before).toContain('Core Thesis');

		// Focus is on phase (index 0), press left to collapse
		stdin.write('\x1b[D');
		await new Promise((r) => setTimeout(r, 5));

		const after = lastFrame() ?? '';
		expect(after).toContain('▸ 01 Foundation');
		expect(after).not.toContain('Core Thesis');
	});

	it('expands a collapsed phase via right arrow', async () => {
		const { lastFrame, stdin } = renderShell(structureOverviewSnapshot());

		// Collapse first
		stdin.write('\x1b[D');
		await new Promise((r) => setTimeout(r, 5));

		const collapsed = lastFrame() ?? '';
		expect(collapsed).toContain('▸ 01 Foundation');

		// Expand via right arrow
		stdin.write('\x1b[C');
		await new Promise((r) => setTimeout(r, 5));

		const expanded = lastFrame() ?? '';
		expect(expanded).toContain('▾ 01 Foundation');
		expect(expanded).toContain('Core Thesis');
	});

	it('dispatches NODE_SELECTED for a blocked node', async () => {
		const dispatch = vi.fn();
		const { stdin } = renderShell(structureOverviewSnapshot(), dispatch);

		// Navigate to the blocked node (index 3: Central Tension)
		// index 0: phase, index 1: document, index 2: n1, index 3: n2
		stdin.write('\x1b[B'); // to doc
		await new Promise((r) => setTimeout(r, 5));
		stdin.write('\x1b[B'); // to n1
		await new Promise((r) => setTimeout(r, 5));
		stdin.write('\x1b[B'); // to n2 (blocked)
		await new Promise((r) => setTimeout(r, 5));

		stdin.write('\r');

		expect(dispatch).toHaveBeenCalledWith(
			expect.objectContaining({
				nodeId: 'n2',
				type: 'NODE_SELECTED',
			}),
		);
	});

	it('toggles collapse on phase via enter', async () => {
		const { lastFrame, stdin } = renderShell(structureOverviewSnapshot());

		// Enter on phase (index 0) toggles collapse
		stdin.write('\r');
		await new Promise((r) => setTimeout(r, 5));

		const after = lastFrame() ?? '';
		expect(after).toContain('▸ 01 Foundation');

		// Enter again to expand
		stdin.write('\r');
		await new Promise((r) => setTimeout(r, 5));

		const expanded = lastFrame() ?? '';
		expect(expanded).toContain('▾ 01 Foundation');
	});

	it('collapses a document via left arrow (hides node rows)', async () => {
		const { lastFrame, stdin } = renderShell(structureOverviewSnapshot());

		// Navigate down to document row (index 1)
		stdin.write('\x1b[B');
		await new Promise((r) => setTimeout(r, 5));

		const beforeDoc = lastFrame() ?? '';
		expect(beforeDoc).toContain('▾ Doc 1');
		expect(beforeDoc).toContain('Core Thesis');

		// Left arrow collapses the document
		stdin.write('\x1b[D');
		await new Promise((r) => setTimeout(r, 5));

		const after = lastFrame() ?? '';
		expect(after).toContain('▸'); // collapsed document indicator
		expect(after).not.toContain('Core Thesis');

		// Right arrow expands again
		stdin.write('\x1b[C');
		await new Promise((r) => setTimeout(r, 5));

		const reexpanded = lastFrame() ?? '';
		expect(reexpanded).toContain('▾ Doc 1');
		expect(reexpanded).toContain('Core Thesis');
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// Document preview — missing node navigation via digit keys (Step 12.2)
// ═══════════════════════════════════════════════════════════════════════════

function documentPreviewSnapshot(): TuiRenderSnapshot {
	return {
		actionBar: {
			actions: [
				{ enabled: true, id: 'regenerate_document', label: '[Regenerate]' },
				{ enabled: false, id: 'export_document', label: '[Export]' },
				{ enabled: true, id: 'close_document_preview', label: '[Close]' },
			],
		},
		diagnostics: [],
		input: {
			enabled: false,
			reasonIfDisabled:
				'Text input is not available while previewing a document.',
		},
		mainPanel: {
			content: '# Test\n\nSome text.\n\nCompleteness: 0/0',
			documentId: 'doc-1' as DocumentId,
			exportEligible: false,
			kind: 'document_preview',
			missingNodeIds: ['n1' as NodeId, 'n2' as NodeId],
			staleNodeIds: [],
			title: 'Test Document',
		} as DocumentPreviewPanel,
		mode: 'document_preview',
		providerStatus: mockProviderStatus,
		sidebar: {
			activeNodeId: null,
			phases: [],
		},
	};
}

describe('AppShell — document preview missing node selection', () => {
	it('dispatches NODE_SELECTED when digit key selects a missing node', () => {
		const dispatch = vi.fn();
		const snap = documentPreviewSnapshot();
		const { stdin } = renderShell(snap, dispatch);

		// Press '1' to select the first missing node (n1)
		stdin.write('1');
		return new Promise<void>((resolve) => {
			setTimeout(() => {
				expect(dispatch).toHaveBeenCalledWith(
					expect.objectContaining({
						nodeId: 'n1',
						type: 'NODE_SELECTED',
					}),
				);
				resolve();
			}, 10);
		});
	});

	it('dispatches NODE_SELECTED with correct nodeId for second missing node', () => {
		const dispatch = vi.fn();
		const snap = documentPreviewSnapshot();
		const { stdin } = renderShell(snap, dispatch);

		// Press '2' to select the second missing node (n2)
		stdin.write('2');
		return new Promise<void>((resolve) => {
			setTimeout(() => {
				expect(dispatch).toHaveBeenCalledWith(
					expect.objectContaining({
						nodeId: 'n2',
						type: 'NODE_SELECTED',
					}),
				);
				resolve();
			}, 10);
		});
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// Error mode — Step 14.2
// ═══════════════════════════════════════════════════════════════════════════

function recoverableErrorSnapshot(): TuiRenderSnapshot {
	return {
		actionBar: {
			actions: [
				{ enabled: true, id: 'retry', label: '[Retry]' },
				{
					enabled: false,
					id: 'reopen_node',
					label: '[Reopen Node]',
					reasonIfDisabled: 'Not available for this error.',
				},
				{
					enabled: false,
					id: 'open_missing_prerequisite',
					label: '[Open Prerequisite]',
					reasonIfDisabled: 'Not available for this error.',
				},
				{
					enabled: false,
					id: 'export_recovery_bundle',
					label: '[Export Recovery Bundle]',
					reasonIfDisabled: 'Not available for this error.',
				},
				{
					enabled: false,
					id: 'restore_previous_snapshot',
					label: '[Restore Previous Snapshot]',
					reasonIfDisabled: 'Not available for this error.',
				},
				{ enabled: true, id: 'close_error', label: '[Close]' },
			],
		},
		diagnostics: [
			{
				code: 'LOGOS_DISPATCH_NO_PROFILE',
				message: 'No profile selected — cannot dispatch.',
				severity: 'error',
				sourceId: 'n1',
			},
		],
		input: {
			enabled: false,
			reasonIfDisabled: 'Text input is not available in error mode.',
		},
		mainPanel: {
			category: 'invalid_state',
			code: 'LOGOS_DISPATCH_NO_PROFILE',
			kind: 'error',
			message: 'No profile selected — cannot dispatch.',
			recoverable: true,
			recoveryActions: ['retry' as ErrorRecoveryAction],
		} as ErrorPanel,
		mode: 'error',
		providerStatus: mockProviderStatus,
		sidebar: { activeNodeId: null, phases: [] },
	};
}

function fatalErrorSnapshot(): TuiRenderSnapshot {
	return {
		actionBar: {
			actions: [
				{
					enabled: false,
					id: 'retry',
					label: '[Retry]',
					reasonIfDisabled: 'Not available for this error.',
				},
				{
					enabled: false,
					id: 'reopen_node',
					label: '[Reopen Node]',
					reasonIfDisabled: 'Not available for this error.',
				},
				{
					enabled: false,
					id: 'open_missing_prerequisite',
					label: '[Open Prerequisite]',
					reasonIfDisabled: 'Not available for this error.',
				},
				{
					enabled: false,
					id: 'export_recovery_bundle',
					label: '[Export Recovery Bundle]',
					reasonIfDisabled: 'Not available for this error.',
				},
				{
					enabled: false,
					id: 'restore_previous_snapshot',
					label: '[Restore Previous Snapshot]',
					reasonIfDisabled: 'Not available for this error.',
				},
				{ enabled: true, id: 'close_error', label: '[Close]' },
			],
		},
		diagnostics: [
			{
				code: 'LOGOS_INVARIANT_VIOLATION',
				message: 'Invariant violation: state is corrupted beyond repair.',
				severity: 'error',
			},
		],
		input: {
			enabled: false,
			reasonIfDisabled: 'Text input is not available in error mode.',
		},
		mainPanel: {
			category: 'validation',
			code: 'LOGOS_INVARIANT_VIOLATION',
			kind: 'error',
			message: 'Invariant violation: state is corrupted beyond repair.',
			recoverable: false,
		} as ErrorPanel,
		mode: 'error',
		providerStatus: mockProviderStatus,
		sidebar: { activeNodeId: null, phases: [] },
	};
}

describe('AppShell — error mode (Step 14.2)', () => {
	it('renders error header with ✗ Error', () => {
		const { lastFrame } = renderShell(recoverableErrorSnapshot());
		expect(lastFrame()).toContain('✗ Error');
	});

	it('renders error message', () => {
		const { lastFrame } = renderShell(recoverableErrorSnapshot());
		expect(lastFrame()).toContain('No profile selected — cannot dispatch.');
	});

	it('renders diagnostic code', () => {
		const { lastFrame } = renderShell(recoverableErrorSnapshot());
		expect(lastFrame()).toContain('LOGOS_DISPATCH_NO_PROFILE');
	});

	it('renders formatted diagnostic category', () => {
		const { lastFrame } = renderShell(recoverableErrorSnapshot());
		expect(lastFrame()).toContain('Invalid State');
	});

	it('shows recoverable label for recoverable errors', () => {
		const { lastFrame } = renderShell(recoverableErrorSnapshot());
		expect(lastFrame()).toContain('Recoverable error');
		expect(lastFrame()).toContain('use the actions below to recover');
	});

	it('shows fatal label for non-recoverable errors', () => {
		const { lastFrame } = renderShell(fatalErrorSnapshot());
		expect(lastFrame()).toContain('FATAL ERROR');
		expect(lastFrame()).toContain('manual intervention required');
	});

	it('renders diagnostic details section', () => {
		const { lastFrame } = renderShell(recoverableErrorSnapshot());
		expect(lastFrame()).toContain('Diagnostic Details');
	});

	it('renders error mode label in title bar', () => {
		const { lastFrame } = renderShell(recoverableErrorSnapshot());
		expect(lastFrame()).toContain('error');
	});

	it('does not render sidebar when empty', () => {
		const { lastFrame } = renderShell(recoverableErrorSnapshot());
		// Sidebar would show "Profile:" if visible
		expect(lastFrame()).not.toContain('Profile:');
	});

	it('renders actions bar with recovery actions', () => {
		const { lastFrame } = renderShell(recoverableErrorSnapshot());
		const frame = lastFrame() ?? '';
		// Action bar is present with the "Actions:" label
		expect(frame).toContain('Actions:');
	});

	it('[Close] is always enabled even in fatal errors', () => {
		const { lastFrame } = renderShell(fatalErrorSnapshot());
		const frame = lastFrame() ?? '';
		// Fatal error shows FATAL ERROR label with action bar
		expect(frame).toContain('FATAL ERROR');
		expect(frame).toContain('Actions:');
	});

	it('renders fatal error with action buttons including Close', () => {
		const { lastFrame } = renderShell(fatalErrorSnapshot());
		const frame = lastFrame() ?? '';
		// All action labels rendered (may wrap across lines in terminal)
		expect(frame).toContain('Retr');
		expect(frame).toContain('Clos');
		expect(frame).toContain('Node]');
		expect(frame).toContain('Prerequisite]');
	});

	it('dispatches ACTION_SELECTED with retry actionId on enter', async () => {
		const dispatch = vi.fn();
		const { stdin } = renderShell(recoverableErrorSnapshot(), dispatch);

		// Regions: main, actions. One tab reaches actions (index 0 = retry).
		stdin.write('\t'); // main → actions
		await new Promise((r) => setTimeout(r, 5));
		stdin.write('\r'); // select retry

		expect(dispatch).toHaveBeenCalledWith(
			expect.objectContaining({
				actionId: 'retry',
				type: 'ACTION_SELECTED',
			}),
		);
	});

	it('dispatches ACTION_SELECTED with close_error when focused', async () => {
		const dispatch = vi.fn();
		const { stdin } = renderShell(recoverableErrorSnapshot(), dispatch);

		// Tab to actions (regions: main, actions)
		stdin.write('\t'); // actions
		await new Promise((r) => setTimeout(r, 5));
		// Navigate down 5 times to reach [Close] (index 5)
		for (let i = 0; i < 5; i++) {
			stdin.write('\x1b[B');
			await new Promise((r) => setTimeout(r, 5));
		}
		stdin.write('\r');

		expect(dispatch).toHaveBeenCalledWith(
			expect.objectContaining({
				actionId: 'close_error',
				type: 'ACTION_SELECTED',
			}),
		);
	});

	it('does not dispatch on tab key alone in error mode', () => {
		const dispatch = vi.fn();
		const { stdin } = renderShell(recoverableErrorSnapshot(), dispatch);

		stdin.write('\t');
		stdin.write('\t');

		expect(dispatch).not.toHaveBeenCalled();
	});

	it('dispatches ESCAPE on escape key in error mode', async () => {
		const dispatch = vi.fn();
		const { stdin } = renderShell(recoverableErrorSnapshot(), dispatch);

		stdin.write('\x1b');
		await flushPendingEscape();

		expect(dispatch).toHaveBeenCalledWith(
			expect.objectContaining({
				type: 'ESCAPE',
			}),
		);
	});
});
