/**
 * Navigation coordination hook for the TUI.
 *
 * Wraps the application-layer dispatch to provide debounced node selection
 * and deselection. Prevents rapid-fire navigation events from flooding the
 * state engine while ensuring the first selection dispatches immediately
 * for responsive UX.
 *
 * The hook also exposes `cancelPendingNavigation()` for cleanup on
 * unmount or when the input focus leaves the sidebar.
 *
 * ### Debounce behavior
 *
 * - First `selectNode(nodeId)` call dispatches immediately.
 * - Subsequent calls within the debounce window (default 150ms) cancel
 *   the pending navigation and schedule the latest node instead.
 * - `deselectNode()` cancels any pending selection and dispatches
 *   `{ type: 'ESCAPE' }` immediately.
 *
 * ### Architecture
 *
 * The TUI is a renderer only. This hook is pure input coordination —
 * it wraps the existing dispatch callback and does not import or call
 * state-engine modules directly. All state mutations are driven by the
 * application layer through the dispatch contract.
 *
 * @see {@link https://logos-engine/docs/13-prototypes.md §4.3}
 * @see {@link https://logos-engine/docs/architecture/06-tui-rendering-architecture.md}
 */
import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { NodeId } from '../../shared/index.js';
import type { TuiDispatchEvent } from '../app-shell.js';

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Configuration for the `useNavigation` hook.
 */
export type UseNavigationOptions = {
	/**
	 * Debounce window in milliseconds for rapid sequential node selections.
	 *
	 * The first selection dispatches immediately. Subsequent selections
	 * within this window are coalesced — only the last one fires.
	 *
	 * @default 150
	 */
	readonly debounceMs?: number;
};

/**
 * Return type of the `useNavigation` hook.
 */
export type NavigationControls = {
	/**
	 * Select a node in the sidebar.
	 *
	 * Dispatches `{ type: 'NODE_SELECTED', nodeId }` via the application
	 * dispatch callback. The first call dispatches immediately;
	 * subsequent calls within the debounce window coallesce to the
	 * last node.
	 *
	 * @param nodeId - The ID of the node to select.
	 */
	selectNode: (nodeId: string) => void;

	/**
	 * Deselect the active node and return to structure overview.
	 *
	 * Cancels any pending selection and dispatches `{ type: 'ESCAPE' }`
	 * immediately.
	 */
	deselectNode: () => void;

	/**
	 * Cancel any pending debounced navigation without dispatching.
	 *
	 * Safe to call at any time (e.g., on unmount or when focus leaves
	 * the sidebar).
	 */
	cancelPendingNavigation: () => void;
};

// ═══════════════════════════════════════════════════════════════════════════
// Defaults
// ═══════════════════════════════════════════════════════════════════════════

const DEFAULT_DEBOUNCE_MS = 150;

// ═══════════════════════════════════════════════════════════════════════════
// Hook implementation
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Coordinate sidebar navigation with debounced dispatch.
 *
 * Wraps the TUI's dispatch callback to prevent rapid-fire node selection
 * events from flooding the application layer / state engine.
 *
 * @param dispatch - The application-layer dispatch callback from
 *   `useTuiApplication()`.
 * @param options  - Configuration (debounce window, etc.).
 * @returns Navigation controls for binding to keyboard handlers.
 *
 * @example
 * ```tsx
 * const { selectNode, deselectNode } = useNavigation(dispatch, { debounceMs: 150 });
 *
 * // In keyboard handler:
 * if (key.return) {
 *   selectNode(focusedNodeId);
 * }
 * if (key.escape) {
 *   deselectNode();
 * }
 * ```
 */
export function useNavigation(
	dispatch: ((event: TuiDispatchEvent) => void) | undefined,
	options?: UseNavigationOptions,
): NavigationControls {
	const debounceMs = options?.debounceMs ?? DEFAULT_DEBOUNCE_MS;

	// Timer ref — stores the pending setTimeout handle.
	// `null` means no pending navigation; a number means a setTimeout
	// is scheduled.
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	// Whether the current dispatch is the first one in a sequence.
	// Resets when the timer fires or is cancelled.
	const isFirstRef = useRef(true);

	// Clear the debounce timer if one is pending.
	const clearTimer = useCallback(() => {
		if (timerRef.current !== null) {
			clearTimeout(timerRef.current);
			timerRef.current = null;
		}
	}, []);

	// Cancel pending navigation and reset first-dispatch flag.
	const cancelPendingNavigation = useCallback(() => {
		clearTimer();
		isFirstRef.current = true;
	}, [clearTimer]);

	// Cleanup on unmount.
	useEffect(() => {
		return () => {
			if (timerRef.current !== null) {
				clearTimeout(timerRef.current);
				timerRef.current = null;
			}
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// ── selectNode ───────────────────────────────────────────────────

	const selectNode = useCallback(
		(nodeId: string) => {
			if (!dispatch) return;

			// First selection in a sequence — dispatch immediately.
			if (isFirstRef.current) {
				isFirstRef.current = false;
				dispatch({ nodeId: nodeId as NodeId, type: 'NODE_SELECTED' });

				// Schedule reset so the next sequence (after user pauses)
				// also starts with an immediate dispatch.
				timerRef.current = setTimeout(() => {
					isFirstRef.current = true;
					timerRef.current = null;
				}, debounceMs);
				return;
			}

			// Subsequent selection — cancel the previous coalesced dispatch
			// and schedule a new one.
			clearTimer();

			timerRef.current = setTimeout(() => {
				dispatch({ nodeId: nodeId as NodeId, type: 'NODE_SELECTED' });
				isFirstRef.current = true;
				timerRef.current = null;
			}, debounceMs);
		},
		[dispatch, debounceMs, clearTimer],
	);

	// ── deselectNode ─────────────────────────────────────────────────

	const deselectNode = useCallback(() => {
		// Cancel any pending selection so it doesn't fire after the
		// deselection.
		cancelPendingNavigation();

		if (dispatch) {
			dispatch({ type: 'ESCAPE' });
		}
	}, [dispatch, cancelPendingNavigation]);

	// ── Return stable controls object ────────────────────────────────

	return useMemo(
		() => ({
			cancelPendingNavigation,
			deselectNode,
			selectNode,
		}),
		[cancelPendingNavigation, deselectNode, selectNode],
	);
}
