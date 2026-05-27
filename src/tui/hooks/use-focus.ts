/**
 * Custom focus management hook for the TUI.
 *
 * Manages focus between regions (sidebar, main, input, actions) and
 * tracks indices within list-based regions (sidebar nodes, action items).
 *
 * This hook does NOT use Ink's built-in focus — it provides its own
 * focus model that the components receive as props.
 */
import { useMemo, useState } from 'react';
import type {
	ActionBarRenderModel,
	InputRenderModel,
	SidebarRenderModel,
} from '../../contracts/index.js';

// ─── Focus regions ──────────────────────────────────────────────────────────

export type FocusRegion = 'sidebar' | 'main' | 'input' | 'actions';

// ─── Hook return type ───────────────────────────────────────────────────────

export type FocusState = {
	/** Current focus region. */
	region: FocusRegion;

	/** Currently focused node index in the sidebar (-1 = none). */
	focusedNodeIndex: number;

	/** Currently focused action index in the action bar (-1 = none). */
	focusedActionIndex: number;

	/** Ordered list of available focus regions based on current snapshot. */
	availableRegions: FocusRegion[];

	/** Total number of nodes in the sidebar (for bounds checking). */
	totalNodes: number;

	/** Total number of actions in the action bar (for bounds checking). */
	totalActions: number;

	/** Move focus to the next region (Tab). */
	focusNextRegion: () => void;

	/** Move focus to the previous region (Shift+Tab). */
	focusPreviousRegion: () => void;

	/** Move focus up within the current list region. */
	focusUp: () => void;

	/** Move focus down within the current list region. */
	focusDown: () => void;

	/** Select the item at the current focus position (Enter). */
	focusSelect: () => void;

	/** Reset focus to the default region for the current mode. */
	resetFocus: () => void;
};

// ─── useFocus ───────────────────────────────────────────────────────────────

export function useFocus(
	sidebar: SidebarRenderModel,
	actionBar: ActionBarRenderModel,
	input: InputRenderModel,
): FocusState {
	const totalNodes = sidebar.phases.reduce(
		(sum, p) =>
			sum + p.documents.reduce((s, d) => s + d.nodes.length, 0),
		0,
	);

	const totalActions = actionBar.actions.length;

	// ── Available regions based on current snapshot state ────────────────

	const availableRegions = useMemo<FocusRegion[]>(() => {
		const regions: FocusRegion[] = [];

		if (totalNodes > 0) {
			regions.push('sidebar');
		}

		regions.push('main');

		if (input.enabled) {
			regions.push('input');
		}

		if (totalActions > 0) {
			regions.push('actions');
		}

		return regions;
	}, [totalNodes, totalActions, input.enabled]);

	// ── Start focused on the first available region ──────────────────────

	const [region, setRegion] = useState<FocusRegion>(
		availableRegions[0] ?? 'main',
	);
	const [focusedNodeIndex, setFocusedNodeIndex] = useState(-1);
	const [focusedActionIndex, setFocusedActionIndex] = useState(-1);

	// ── Derived: which index is active based on current region ───────────

	const activeNodeIndex =
		region === 'sidebar' ? Math.max(0, focusedNodeIndex) : focusedNodeIndex;
	const activeActionIndex =
		region === 'actions'
			? Math.max(0, focusedActionIndex)
			: focusedActionIndex;

	// ── Region navigation ────────────────────────────────────────────────

	const focusNextRegion = () => {
		const idx = availableRegions.indexOf(region);
		const next = (idx + 1) % availableRegions.length;
		const nextRegion = availableRegions[next]!;
		setRegion(nextRegion);

		if (nextRegion === 'sidebar') {
			setFocusedNodeIndex(0);
			setFocusedActionIndex(-1);
		} else if (nextRegion === 'actions') {
			setFocusedNodeIndex(-1);
			setFocusedActionIndex(0);
		} else {
			setFocusedNodeIndex(-1);
			setFocusedActionIndex(-1);
		}
	};

	const focusPreviousRegion = () => {
		const idx = availableRegions.indexOf(region);
		const prev =
			(idx - 1 + availableRegions.length) % availableRegions.length;
		const prevRegion = availableRegions[prev]!;
		setRegion(prevRegion);

		if (prevRegion === 'sidebar') {
			setFocusedNodeIndex(totalNodes - 1);
			setFocusedActionIndex(-1);
		} else if (prevRegion === 'actions') {
			setFocusedNodeIndex(-1);
			setFocusedActionIndex(totalActions - 1);
		} else {
			setFocusedNodeIndex(-1);
			setFocusedActionIndex(-1);
		}
	};

	// ── List navigation (up/down within sidebar or actions) ──────────────

	const focusUp = () => {
		if (region === 'sidebar' && totalNodes > 0) {
			setFocusedNodeIndex((prev) =>
				prev <= 0 ? totalNodes - 1 : prev - 1,
			);
		} else if (region === 'actions' && totalActions > 0) {
			setFocusedActionIndex((prev) =>
				prev <= 0 ? totalActions - 1 : prev - 1,
			);
		}
	};

	const focusDown = () => {
		if (region === 'sidebar' && totalNodes > 0) {
			setFocusedNodeIndex((prev) =>
				prev >= totalNodes - 1 ? 0 : prev + 1,
			);
		} else if (region === 'actions' && totalActions > 0) {
			setFocusedActionIndex((prev) =>
				prev >= totalActions - 1 ? 0 : prev + 1,
			);
		}
	};

	// ── Select handler (Enter) — no-op at hook level; consumer dispatches ─

	const focusSelect = () => {
		// Selection is handled by the application layer via
		// the dispatch callback. The hook just tracks focus.
	};

	// ── Reset ─────────────────────────────────────────────────────────────

	const resetFocus = () => {
		const first = availableRegions[0] ?? 'main';
		setRegion(first);
		setFocusedNodeIndex(first === 'sidebar' ? 0 : -1);
		setFocusedActionIndex(first === 'actions' ? 0 : -1);
	};

	return {
		availableRegions,
		focusDown,
		focusNextRegion,
		focusPreviousRegion,
		focusSelect,
		focusUp,
		focusedActionIndex: activeActionIndex,
		focusedNodeIndex: activeNodeIndex,
		region,
		resetFocus,
		totalActions,
		totalNodes,
	};
}
