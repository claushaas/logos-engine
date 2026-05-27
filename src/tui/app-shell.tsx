/**
 * App Shell — top-level TUI component.
 *
 * Owns the global layout, resolves focus management, and routes
 * keyboard events to the application layer via dispatch.
 *
 * The TUI is a renderer only. It never owns state logic, lifecycle
 * rules, or prompt selection. It renders what the state engine says
 * is true.
 *
 * @see {@link https://logos-engine/docs/08-tui-state-and-rendering-contract.md}
 * @see {@link https://logos-engine/docs/architecture/06-tui-rendering-architecture.md}
 */
import { Box, Text, useInput } from 'ink';
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
} from 'react';
import type {
	ActionBarRenderModel,
	InputRenderModel,
	RuntimeDiagnostic,
	SidebarRenderModel,
	TuiRenderSnapshot,
} from '../contracts/index.js';
import type { NodeId } from '../shared/index.js';
import { MainPanel } from './components/MainPanel.js';
import { Sidebar } from './components/Sidebar.js';
import { useFocus } from './hooks/use-focus.js';

// ─── TUI dispatch event type ────────────────────────────────────────────────

/**
 * Events that the TUI shell dispatches to the application layer.
 *
 * These are user-intent events — the application layer translates them
 * into state-engine events. The TUI never calls the state engine directly.
 */
export type TuiDispatchEvent =
	| { readonly type: 'NODE_SELECTED'; readonly nodeId: NodeId }
	| { readonly type: 'ACTION_SELECTED'; readonly actionId: string; readonly nodeAction?: string }
	| { readonly type: 'ESCAPE' };

// ─── TUI application context ────────────────────────────────────────────────

export type TuiApplicationContextValue = {
	readonly snapshot: TuiRenderSnapshot;
	readonly dispatch?: (event: TuiDispatchEvent) => void;
};

const TuiApplicationContext = createContext<TuiApplicationContextValue | null>(
	null,
);

// ─── Provider ───────────────────────────────────────────────────────────────

export type TuiApplicationProviderProps = {
	readonly snapshot: TuiRenderSnapshot;
	readonly dispatch?: (event: TuiDispatchEvent) => void;
	readonly children: React.ReactNode;
};

export function TuiApplicationProvider({
	children,
	dispatch,
	snapshot,
}: TuiApplicationProviderProps) {
	const value = useMemo<TuiApplicationContextValue>(() => {
		if (dispatch !== undefined) {
			return { dispatch, snapshot };
		}

		return { snapshot };
	}, [dispatch, snapshot]);

	return (
		<TuiApplicationContext.Provider value={value}>
			{children}
		</TuiApplicationContext.Provider>
	);
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useTuiApplication(): TuiApplicationContextValue {
	const ctx = useContext(TuiApplicationContext);
	if (ctx === null) {
		throw new Error(
			'useTuiApplication must be used within a TuiApplicationProvider',
		);
	}

	return ctx;
}

// ─── Diagnostic entry helper ────────────────────────────────────────────────

function DiagnosticEntry({
	diagnostic,
}: {
	readonly diagnostic: RuntimeDiagnostic;
}) {
	const icon =
		diagnostic.severity === 'error'
			? '✗'
			: diagnostic.severity === 'warning'
				? '⚠'
				: 'ℹ';

	if (diagnostic.severity === 'error') {
		return (
			<Box marginRight={2}>
				<Text color="red">
					{icon} {diagnostic.message}
				</Text>
			</Box>
		);
	}

	if (diagnostic.severity === 'warning') {
		return (
			<Box marginRight={2}>
				<Text color="yellow">
					{icon} {diagnostic.message}
				</Text>
			</Box>
		);
	}

	return (
		<Box marginRight={2}>
			<Text>
				{icon} {diagnostic.message}
			</Text>
		</Box>
	);
}

// ─── AppShell ───────────────────────────────────────────────────────────────

/**
 * Renders the top-level application layout:
 * - Sidebar (left panel) with profile tree
 * - Main panel (right area) with mode-specific content
 *
 * Handles keyboard input and focus management via `useFocus`.
 */
export function AppShell() {
	const { dispatch, snapshot } = useTuiApplication();

	// ── Focus management ─────────────────────────────────────────────────

	const focus = useFocus(
		snapshot.sidebar,
		snapshot.actionBar,
		snapshot.input,
	);

	// Reset focus when snapshot changes (e.g., mode switch)
	const snapshotKey = useMemo(
		() => `${snapshot.mode}:${snapshot.sidebar.activeNodeId ?? 'none'}`,
		[snapshot.mode, snapshot.sidebar.activeNodeId],
	);

	useEffect(() => {
		focus.resetFocus();
	}, [snapshotKey]);

	// ── Keyboard handler ─────────────────────────────────────────────────

	const handleInput = useCallback(
		(input: string, key: { upArrow: boolean; downArrow: boolean; return: boolean; escape: boolean; tab: boolean; shift: boolean }) => {
			// Tab / Shift+Tab — cycle focus regions
			if (key.tab) {
				if (key.shift) {
					focus.focusPreviousRegion();
				} else {
					focus.focusNextRegion();
				}
				return;
			}

			// Up/Down arrows — navigate within current region
			if (key.upArrow) {
				focus.focusUp();
				return;
			}

			if (key.downArrow) {
				focus.focusDown();
				return;
			}

			// Enter — select focused item
			if (key.return) {
				if (focus.region === 'sidebar') {
					// Find the node at the focused index
					let idx = 0;
					for (const phase of snapshot.sidebar.phases) {
						for (const doc of phase.documents) {
							for (const node of doc.nodes) {
								if (idx === focus.focusedNodeIndex) {
									dispatch?.({
										nodeId: node.nodeId,
										type: 'NODE_SELECTED',
									});
									return;
								}
								idx++;
							}
						}
					}
				} else if (focus.region === 'actions') {
					const action =
						snapshot.actionBar.actions[
							focus.focusedActionIndex
						];
					if (action?.enabled) {
						const dispEvent: TuiDispatchEvent =
							action.nodeAction !== undefined
								? {
										actionId: action.id,
										nodeAction: action.nodeAction,
										type: 'ACTION_SELECTED',
								  }
								: {
										actionId: action.id,
										type: 'ACTION_SELECTED',
								  };
						dispatch?.(dispEvent);
					}
				} else if (focus.region === 'input') {
					// Input region Enter means submit — placeholder for now
				}

				return;
			}

			// Escape — return from sub-mode
			if (key.escape) {
				dispatch?.({ type: 'ESCAPE' });
				return;
			}
		},
		[dispatch, focus, snapshot.actionBar.actions, snapshot.sidebar.phases],
	);

	useInput(handleInput);

	// ── Render ───────────────────────────────────────────────────────────

	const showSidebar =
		snapshot.sidebar.phases.length > 0 ||
		snapshot.sidebar.profileTitle !== undefined;

	return (
		<Box flexDirection="column" flexGrow={1}>
			{/* Title bar */}
			<Box borderBottom={true} borderStyle="single" paddingX={1}>
				<Text bold={true}>LOGOS Engine</Text>
				{snapshot.mode !== 'idle' && (
					<Text dimColor={true}> — {snapshot.mode}</Text>
				)}
			</Box>

			{/* Body: sidebar + main panel */}
			<Box flexDirection="row" flexGrow={1}>
				{showSidebar && (
					<Sidebar
						focusedNodeIndex={focus.focusedNodeIndex}
						focusedRegion={
							focus.availableRegions.includes('sidebar')
								? focus.region
								: null
						}
						sidebar={snapshot.sidebar}
					/>
				)}

				<MainPanel
					actionBar={snapshot.actionBar}
					focusedActionIndex={focus.focusedActionIndex}
					focusedRegion={
						focus.availableRegions.includes('main')
							? focus.region
							: null
					}
					input={snapshot.input}
					mainPanel={snapshot.mainPanel}
				/>
			</Box>

			{/* Diagnostics footer (only when diagnostics exist) */}
			{snapshot.diagnostics.length > 0 && (
				<Box borderTop={true} borderStyle="single" paddingX={1}>
					{snapshot.diagnostics.map(
						(d: RuntimeDiagnostic, i: number) => (
							<DiagnosticEntry
								key={`${d.code}-${i}`}
								diagnostic={d}
							/>
						),
					)}
				</Box>
			)}
		</Box>
	);
}
