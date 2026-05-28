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
	useState,
} from 'react';
import type {
	ProviderStatus,
	RuntimeDiagnostic,
	TuiRenderSnapshot,
} from '../contracts/index.js';
import type { NodeId } from '../shared/index.js';
import { DiagnosticsPanel } from './components/DiagnosticsPanel.js';
import { MainPanel } from './components/MainPanel.js';
import { flattenSidebarTree } from './components/NodeTree.js';
import { Sidebar } from './components/Sidebar.js';
import { useFocus } from './hooks/use-focus.js';
import { useNavigation } from './hooks/use-navigation.js';

// ─── TUI dispatch event type ────────────────────────────────────────────────

/**
 * Events that the TUI shell dispatches to the application layer.
 *
 * These are user-intent events — the application layer translates them
 * into state-engine events. The TUI never calls the state engine directly.
 */
export type TuiDispatchEvent =
	| { readonly type: 'NODE_SELECTED'; readonly nodeId: NodeId }
	| {
			readonly type: 'ACTION_SELECTED';
			readonly actionId: string;
			readonly nodeAction?: string;
	  }
	| {
			readonly type: 'USER_MESSAGE';
			readonly content: string;
			readonly submitAction?: string;
	  }
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

// biome-ignore lint/style/useComponentExportOnlyModules: custom hook colocated with provider component
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

// ─── Provider status badge helper ───────────────────────────────────────────

/** Resolve a color for the provider status badge. */
function providerStatusColor(status: ProviderStatus): string {
	switch (status.mode) {
		case 'real':
			return 'green';
		case 'injected':
			return 'cyan';
		case 'unconfigured':
			return 'yellow';
		default:
			return 'grey';
	}
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

	// ── Navigation coordination (debounced selection / deselection) ─────

	const navigation = useNavigation(dispatch);

	// ── Diagnostics panel toggle (ephemeral TUI state) ──────────────────

	const [showDiagnosticsPanel, setShowDiagnosticsPanel] = useState(false);

	// ── Ephemeral input buffer (TUI-owned transient state) ───────────────

	const [inputBuffer, setInputBuffer] = useState('');

	// ── Collapse state (ephemeral TUI state — never persisted) ───────────

	const [collapsedPhaseIds, setCollapsedPhaseIds] = useState<
		ReadonlySet<string>
	>(new Set());
	const [collapsedDocumentIds, setCollapsedDocumentIds] = useState<
		ReadonlySet<string>
	>(new Set());

	// ── Visible items (flattened tree respecting collapse state) ─────────

	const visibleItems = useMemo(
		() =>
			flattenSidebarTree(
				snapshot.sidebar,
				collapsedPhaseIds,
				collapsedDocumentIds,
			),
		[snapshot.sidebar, collapsedPhaseIds, collapsedDocumentIds],
	);

	// ── Focus management ─────────────────────────────────────────────────

	const focus = useFocus(snapshot.sidebar, snapshot.actionBar, snapshot.input, {
		totalSidebarItems: visibleItems.length,
	});

	// Reset focus and clear input buffer when snapshot changes (e.g., mode switch)
	const snapshotKey = useMemo(
		() => `${snapshot.mode}:${snapshot.sidebar.activeNodeId ?? 'none'}`,
		[snapshot.mode, snapshot.sidebar.activeNodeId],
	);

	useEffect(() => {
		void snapshotKey;
		focus.resetFocus();
		setInputBuffer('');
	}, [snapshotKey, focus.resetFocus]);

	// ── Keyboard handler ─────────────────────────────────────────────────

	const handleInput = useCallback(
		(
			input: string,
			key: {
				upArrow: boolean;
				downArrow: boolean;
				leftArrow: boolean;
				rightArrow: boolean;
				return: boolean;
				escape: boolean;
				tab: boolean;
				shift: boolean;
				ctrl: boolean;
				meta: boolean;
				backspace: boolean;
				delete: boolean;
			},
		) => {
			// ── Ctrl+D: toggle diagnostics panel (always available) ──────

			if (key.ctrl && input.toLowerCase() === 'd') {
				setShowDiagnosticsPanel((prev) => !prev);
				return;
			}

			// ── Diagnostics panel open: Escape closes it ────────────────

			if (showDiagnosticsPanel && key.escape) {
				setShowDiagnosticsPanel(false);
				return;
			}

			// ── Text input mode: append printable chars, handle special keys

			if (focus.region === 'input' && snapshot.input.enabled) {
				// Tab — cycle focus regions (must be handled before printable check)
				if (key.tab) {
					if (key.shift) {
						focus.focusPreviousRegion();
					} else {
						focus.focusNextRegion();
					}
					return;
				}

				// Enter — submit the input buffer
				if (key.return) {
					if (inputBuffer.trim().length > 0) {
						const event: TuiDispatchEvent =
							snapshot.input.submitAction !== undefined
								? {
										content: inputBuffer,
										submitAction: snapshot.input.submitAction,
										type: 'USER_MESSAGE',
									}
								: {
										content: inputBuffer,
										type: 'USER_MESSAGE',
									};
						dispatch?.(event);
						setInputBuffer('');
					}
					return;
				}

				// Backspace / Delete — remove last character
				if (key.backspace || key.delete) {
					setInputBuffer((prev) => prev.slice(0, -1));
					return;
				}

				// Escape — clear input buffer
				if (key.escape) {
					setInputBuffer('');
					return;
				}

				// Append printable characters to the buffer
				if (input.length > 0 && !key.upArrow && !key.downArrow) {
					setInputBuffer((prev) => prev + input);
				}

				return;
			}

			// ── Navigation mode (non-input focus or input disabled)

			// Tab / Shift+Tab — cycle focus regions
			if (key.tab) {
				if (key.shift) {
					focus.focusPreviousRegion();
				} else {
					focus.focusNextRegion();
				}
				return;
			}

			// Left/Right arrows — collapse/expand sidebar items
			if (
				focus.region === 'sidebar' &&
				focus.focusedNodeIndex >= 0 &&
				focus.focusedNodeIndex < visibleItems.length
			) {
				// biome-ignore lint/style/noNonNullAssertion: focusedNodeIndex validated against visibleItems.length above
				const item = visibleItems[focus.focusedNodeIndex]!;

				if (key.leftArrow) {
					if (item.kind === 'phase' && item.expanded) {
						setCollapsedPhaseIds((prev) => {
							const next = new Set(prev);
							next.add(item.phaseId);
							return next;
						});
						return;
					}
					if (item.kind === 'document' && item.expanded) {
						setCollapsedDocumentIds((prev) => {
							const next = new Set(prev);
							next.add(item.documentId);
							return next;
						});
						return;
					}
					// Left on a node: collapse its parent document
					if (item.kind === 'node') {
						// Find the parent document by scanning backwards
						for (let i = focus.focusedNodeIndex - 1; i >= 0; i--) {
							const prev = visibleItems[i];
							if (
								prev !== undefined &&
								prev.kind === 'document' &&
								prev.expanded
							) {
								setCollapsedDocumentIds((prevSet) => {
									const next = new Set(prevSet);
									next.add(prev.documentId);
									return next;
								});
								return;
							}
						}
					}
					return;
				}

				if (key.rightArrow) {
					if (item.kind === 'phase' && !item.expanded) {
						setCollapsedPhaseIds((prev) => {
							const next = new Set(prev);
							next.delete(item.phaseId);
							return next;
						});
						return;
					}
					if (item.kind === 'document' && !item.expanded) {
						setCollapsedDocumentIds((prev) => {
							const next = new Set(prev);
							next.delete(item.documentId);
							return next;
						});
						return;
					}
					return;
				}
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
					const focusedItem =
						focus.focusedNodeIndex >= 0 &&
						focus.focusedNodeIndex < visibleItems.length
							? visibleItems[focus.focusedNodeIndex]
							: undefined;

					// Node → select it (even if blocked)
					if (focusedItem?.kind === 'node') {
						navigation.selectNode(focusedItem.nodeId as string);
						return;
					}

					// Phase → toggle collapse
					if (focusedItem?.kind === 'phase') {
						if (focusedItem.expanded) {
							setCollapsedPhaseIds((prev) => {
								const next = new Set(prev);
								next.add(focusedItem.phaseId);
								return next;
							});
						} else {
							setCollapsedPhaseIds((prev) => {
								const next = new Set(prev);
								next.delete(focusedItem.phaseId);
								return next;
							});
						}
						return;
					}

					// Document → toggle collapse
					if (focusedItem?.kind === 'document') {
						if (focusedItem.expanded) {
							setCollapsedDocumentIds((prev) => {
								const next = new Set(prev);
								next.add(focusedItem.documentId);
								return next;
							});
						} else {
							setCollapsedDocumentIds((prev) => {
								const next = new Set(prev);
								next.delete(focusedItem.documentId);
								return next;
							});
						}
						return;
					}
				} else if (focus.region === 'actions') {
					const action = snapshot.actionBar.actions[focus.focusedActionIndex];
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
				}

				return;
			}

			// Escape — return from sub-mode
			if (key.escape) {
				navigation.deselectNode();
				return;
			}
		},
		[
			dispatch,
			focus,
			inputBuffer,
			navigation,
			showDiagnosticsPanel,
			snapshot.actionBar.actions,
			snapshot.input.enabled,
			snapshot.input.submitAction,
			visibleItems,
		],
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
				<Box marginLeft={1}>
					<Text color={providerStatusColor(snapshot.providerStatus)}>
						[{snapshot.providerStatus.label}]
					</Text>
				</Box>
				{snapshot.providerStatus.guidance !== null && (
					<Box marginLeft={1}>
						<Text dimColor={true} wrap="truncate">
							— {snapshot.providerStatus.guidance}
						</Text>
					</Box>
				)}
			</Box>

			{/* Body: sidebar + main panel (or diagnostics overlay) */}
			<Box flexDirection="row" flexGrow={1}>
				{showDiagnosticsPanel ? (
					<DiagnosticsPanel
						actionBar={snapshot.actionBar}
						diagnostics={snapshot.diagnostics}
						focusedActionIndex={focus.focusedActionIndex}
						focusedRegion={
							focus.availableRegions.includes('main') ? focus.region : null
						}
						input={snapshot.input}
					/>
				) : (
					<>
						{showSidebar && (
							<Sidebar
								collapsedDocumentIds={collapsedDocumentIds}
								collapsedPhaseIds={collapsedPhaseIds}
								focusedItemIndex={focus.focusedNodeIndex}
								isFocused={
									focus.availableRegions.includes('sidebar') &&
									focus.region === 'sidebar'
								}
								sidebar={snapshot.sidebar}
							/>
						)}

						<MainPanel
							actionBar={snapshot.actionBar}
							focusedActionIndex={focus.focusedActionIndex}
							focusedRegion={
								focus.availableRegions.includes('main') ? focus.region : null
							}
							input={snapshot.input}
							inputValue={inputBuffer}
							mainPanel={snapshot.mainPanel}
							onSelectMissingNode={(nodeId: string) => {
								dispatch?.({ nodeId: nodeId as NodeId, type: 'NODE_SELECTED' });
							}}
						/>
					</>
				)}
			</Box>

			{/* Diagnostics footer (hidden when full panel is open to avoid duplication) */}
			{!showDiagnosticsPanel && snapshot.diagnostics.length > 0 && (
				<Box borderStyle="single" borderTop={true} paddingX={1}>
					{snapshot.diagnostics.map((d: RuntimeDiagnostic, _i: number) => (
						<DiagnosticEntry diagnostic={d} key={d.code} />
					))}
				</Box>
			)}
		</Box>
	);
}
