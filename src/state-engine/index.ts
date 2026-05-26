/**
 * State engine module — deterministic runtime state management.
 *
 * The state engine owns all runtime state. Every mutation passes through
 * pure functions that return new state objects. The TUI and application
 * layer consume derived snapshots — never raw state directly.
 *
 * Exports:
 * - State engine operations: `createSession`, `selectProfile`,
 *   `changeProfile`, `selectNode`, `applyLifecycleTransition`
 * - Lifecycle validation: `isValidTransition`, `allLifecycles`
 * - Allowed actions: `getAllowedActions`, `isActionAllowed`
 * - Session mode resolution: `resolveSessionMode`,
 *   `resolveSessionModeWithDiagnostics`, `SessionModeResolution`
 * - Type helpers: `StateEngineResult`, `StateDiagnostic`,
 *   `StateEngineEvent`, `diagnostic`, `stateOk`, `stateErr`
 */
export {
	getAllowedActions,
	isActionAllowed,
} from './allowed-actions.js';
export {
	type ApplyLifecycleTransitionOptions,
	allLifecycles,
	applyLifecycleTransition,
	isValidTransition,
	type LifecycleTransitionEvent,
} from './node-lifecycle.js';
export {
	resolveSessionMode,
	resolveSessionModeWithDiagnostics,
	type SessionModeResolution,
} from './session-mode.js';
export {
	changeProfile,
	createSession,
	deselectNode,
	selectNode,
	selectProfile,
} from './state-engine.js';
export {
	diagnostic,
	type StateDiagnostic,
	type StateEngineEvent,
	type StateEngineResult,
	stateErr,
	stateOk,
} from './types.js';
