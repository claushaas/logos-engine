/**
 * Tests for the `useNavigation` hook (Step 9.2).
 *
 * Covers:
 *  - First `selectNode` dispatches immediately.
 *  - Rapid subsequent `selectNode` calls coalesce to the last node.
 *  - `deselectNode` cancels pending selection and dispatches ESCAPE.
 *  - Cleanup clears pending timers.
 *  - Dispatch with `undefined` callback is a no-op.
 */
import { Text } from 'ink';
import { render } from 'ink-testing-library';
import React, { useEffect, useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TuiDispatchEvent } from '../../src/tui/app-shell.js';
import { useNavigation } from '../../src/tui/hooks/use-navigation.js';

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

function createDispatchSpy() {
	return vi.fn<(event: TuiDispatchEvent) => void>();
}

/**
 * Test component that exposes navigation controls via a ref.
 *
 * Renders nothing visible; the caller can inspect the ref after render
 * to drive navigation actions.
 */
function TestHarness({
	dispatch,
	debounceMs,
	controlsRef,
}: {
	dispatch?: (event: TuiDispatchEvent) => void;
	debounceMs?: number;
	controlsRef: React.MutableRefObject<ReturnType<typeof useNavigation> | null>;
}) {
	const nav = useNavigation(dispatch, debounceMs ? { debounceMs } : undefined);

	// Persist nav object for the test to drive.
	useEffect(() => {
		controlsRef.current = nav;
	}, [nav]);

	return React.createElement(Text, null, 'test-harness');
}

/**
 * Helper: render the test harness and get navigation controls.
 */
function renderNavigationControls(
	dispatch?: (event: TuiDispatchEvent) => void,
	debounceMs?: number,
): ReturnType<typeof useNavigation> {
	const controlsRef: React.MutableRefObject<ReturnType<typeof useNavigation> | null> = {
		current: null,
	};

	render(
		React.createElement(TestHarness, {
			controlsRef,
			debounceMs,
			dispatch,
		}),
	);

	return controlsRef.current!;
}

// ═══════════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════════

describe('useNavigation', () => {
	let dispatch: ReturnType<typeof createDispatchSpy>;

	beforeEach(() => {
		vi.useFakeTimers();
		dispatch = createDispatchSpy();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('dispatches NODE_SELECTED immediately on first selectNode call', () => {
		const nav = renderNavigationControls(dispatch);

		nav.selectNode('node-a');

		expect(dispatch).toHaveBeenCalledTimes(1);
		expect(dispatch).toHaveBeenCalledWith({
			nodeId: 'node-a',
			type: 'NODE_SELECTED',
		});
	});

	it('coalesces rapid selectNode calls to the last node', () => {
		const nav = renderNavigationControls(dispatch, 150);

		// First call — dispatched immediately.
		nav.selectNode('node-a');
		expect(dispatch).toHaveBeenCalledTimes(1);
		expect(dispatch).toHaveBeenCalledWith({
			nodeId: 'node-a',
			type: 'NODE_SELECTED',
		});

		dispatch.mockClear();

		// Rapid second call — should NOT dispatch immediately.
		nav.selectNode('node-b');
		expect(dispatch).not.toHaveBeenCalled();

		// Rapid third call — cancels pending node-b, schedules node-c.
		nav.selectNode('node-c');
		expect(dispatch).not.toHaveBeenCalled();

		// Advance past the debounce window.
		vi.advanceTimersByTime(160);

		// Only the last call (node-c) should fire.
		expect(dispatch).toHaveBeenCalledTimes(1);
		expect(dispatch).toHaveBeenCalledWith({
			nodeId: 'node-c',
			type: 'NODE_SELECTED',
		});
	});

	it('resets first-dispatch flag after debounce window elapses', () => {
		const nav = renderNavigationControls(dispatch, 150);

		// First sequence
		nav.selectNode('node-a');
		expect(dispatch).toHaveBeenCalledTimes(1);

		// Advance past debounce window — resets the first-dispatch flag.
		vi.advanceTimersByTime(200);

		dispatch.mockClear();

		// Second sequence — should dispatch immediately again.
		nav.selectNode('node-b');
		expect(dispatch).toHaveBeenCalledTimes(1);
		expect(dispatch).toHaveBeenCalledWith({
			nodeId: 'node-b',
			type: 'NODE_SELECTED',
		});
	});

	it('deselectNode cancels pending selection and dispatches ESCAPE', () => {
		const nav = renderNavigationControls(dispatch, 150);

		// First selection dispatches immediately.
		nav.selectNode('node-a');
		expect(dispatch).toHaveBeenCalledTimes(1);

		dispatch.mockClear();

		// Rapid second selection — scheduled but not yet fired.
		nav.selectNode('node-b');
		expect(dispatch).not.toHaveBeenCalled();

		// Deselect — should cancel pending node-b and dispatch ESCAPE immediately.
		nav.deselectNode();

		expect(dispatch).toHaveBeenCalledTimes(1);
		expect(dispatch).toHaveBeenCalledWith({ type: 'ESCAPE' });

		// Advance past debounce — node-b should NOT fire (cancelled).
		vi.advanceTimersByTime(200);

		// Still only 1 call (ESCAPE).
		expect(dispatch).toHaveBeenCalledTimes(1);
	});

	it('cancelPendingNavigation clears timer without dispatching', () => {
		const nav = renderNavigationControls(dispatch, 150);

		// Start a sequence with immediate dispatch.
		nav.selectNode('node-a');

		dispatch.mockClear();

		// Schedule a coalesced selection.
		nav.selectNode('node-b');

		// Cancel before it fires.
		nav.cancelPendingNavigation();

		// Advance — nothing should fire.
		vi.advanceTimersByTime(200);

		expect(dispatch).not.toHaveBeenCalled();
	});

	it('is a no-op when dispatch is undefined', () => {
		const nav = renderNavigationControls(undefined);

		nav.selectNode('node-a');
		nav.deselectNode();
		nav.cancelPendingNavigation();

		// No errors thrown — that's the assertion.
	});

	it('cleanup on unmount clears pending timers', () => {
		const controlsRef: React.MutableRefObject<ReturnType<typeof useNavigation> | null> = {
			current: null,
		};

		const { unmount } = render(
			React.createElement(TestHarness, {
				controlsRef,
				debounceMs: 150,
				dispatch,
			}),
		);

		const nav = controlsRef.current!;

		// First immediate dispatch.
		nav.selectNode('node-a');

		dispatch.mockClear();

		// Schedule a coalesced selection.
		nav.selectNode('node-b');

		// Unmount before timer fires.
		unmount();

		// Advance timers — should not throw or call dispatch.
		vi.advanceTimersByTime(200);

		expect(dispatch).not.toHaveBeenCalled();
	});
});
