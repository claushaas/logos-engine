/**
 * TUI module — terminal user interface for LOGOS Engine.
 *
 * The TUI is a state renderer. It renders what the state engine says is true.
 * It never owns business logic, prompt logic, node lifecycle, or document
 * readiness.
 *
 * Exports:
 * - `TuiApplicationProvider` / `useTuiApplication` — context for render snapshot
 * - `AppShell` — top-level layout component
 * - Component library for use in tests and composition
 */

// Shell
export {
	AppShell,
	type TuiApplicationContextValue,
	TuiApplicationProvider,
	type TuiApplicationProviderProps,
	type TuiDispatchEvent,
	useTuiApplication,
} from './app-shell.js';

// Components
export { ActionBar } from './components/ActionBar.js';
export { CanonicalPreview } from './components/CanonicalPreview.js';
export { ConversationPanel } from './components/ConversationPanel.js';
export { DiagnosticsPanel } from './components/DiagnosticsPanel.js';
export { InputArea } from './components/InputArea.js';
export { MainPanel } from './components/MainPanel.js';
export {
	flattenSidebarTree,
	NodeTree,
	type VisibleDocument,
	type VisibleItem,
	type VisibleNode,
	type VisiblePhase,
} from './components/NodeTree.js';
export { Sidebar } from './components/Sidebar.js';

// Hooks
export {
	type FocusRegion,
	type FocusState,
	type UseFocusOptions,
	useFocus,
} from './hooks/use-focus.js';
export {
	type NavigationControls,
	type UseNavigationOptions,
	useNavigation,
} from './hooks/use-navigation.js';
