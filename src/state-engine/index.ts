/**
 * State engine module — deterministic runtime state management.
 *
 * The state engine owns all runtime state. Every mutation passes through
 * pure functions that return new state objects. The TUI and application
 * layer consume derived snapshots — never raw state directly.
 *
 * Exports:
 * - State engine operations: `createSession`, `selectProfile`,
 *   `changeProfile`, `selectNode`
 * - Session mode resolution: `resolveSessionMode`,
 *   `resolveSessionModeWithDiagnostics`, `SessionModeResolution`
 * - Type helpers: `StateEngineResult`, `StateDiagnostic`,
 *   `StateEngineEvent`, `diagnostic`, `stateOk`, `stateErr`
 */
export {
	changeProfile,
	createSession,
	deselectNode,
	selectNode,
	selectProfile,
} from './state-engine.js';
export {
	resolveSessionMode,
	resolveSessionModeWithDiagnostics,
	type SessionModeResolution,
} from './session-mode.js';
export {
	diagnostic,
	stateErr,
	stateOk,
	type StateDiagnostic,
	type StateEngineEvent,
	type StateEngineResult,
} from './types.js';
