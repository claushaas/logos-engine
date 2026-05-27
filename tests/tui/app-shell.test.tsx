/**
 * Tests for Step 8.2 — TUI shell and layout components.
 *
 * Uses ink-testing-library for render output assertions.
 * Tests cover: idle screen, structure overview, node focus,
 * focus management, keyboard dispatch.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'ink-testing-library';

import type {
	DocumentId,
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
				{ enabled: true, id: 'accept', label: '[Accept]', nodeAction: 'accept' as never },
				{ enabled: true, id: 'edit', label: '[Edit]', nodeAction: 'edit' as never },
			],
		},
		diagnostics: [
			{ code: 'TEST_INFO', message: 'Snapshot loaded.', severity: 'info' },
		],
		input: {
			enabled: true,
			placeholder: 'Type your answer…',
			submitAction: 'answer',
		},
		mainPanel: {
			breadcrumb: 'Foundation / Doc 1 / Core Thesis',
			canonicalAnswerAccepted: false,
			canonicalAnswerPreview: 'The core thesis goes here.',
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

	it('renders enabled input area', () => {
		const { lastFrame } = renderShell(nodeFocusSnapshot());
		expect(lastFrame()).toContain('Type your answer…');
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
	it('dispatches NODE_SELECTED on enter when sidebar node is focused', () => {
		const dispatch = vi.fn();
		const { stdin } = renderShell(structureOverviewSnapshot(), dispatch);

		// Tab to sidebar (first available region)
		stdin.write('\t');
		// Now sidebar should be focused with node index 0
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
});

// ═══════════════════════════════════════════════════════════════════════════
// Focus indicators
// ═══════════════════════════════════════════════════════════════════════════

describe('AppShell — focus indicators', () => {
	it('tab cycles through focus regions and shows focus markers', () => {
		const { lastFrame, stdin } = renderShell(nodeFocusSnapshot());

		// Tab to actions (3 tabs from default sidebar focus)
		stdin.write('\t'); // main
		stdin.write('\t'); // input
		stdin.write('\t'); // actions
		const f1 = lastFrame() ?? '';
		// Action should have ▶ marker
		expect(f1).toContain('▶');
	});
});
