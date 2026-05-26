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
 * - Type helpers: `StateEngineResult`, `StateDiagnostic`,
 *   `StateEngineEvent`, `diagnostic`, `stateOk`, `stateErr`
 */
export {
	changeProfile,
	createSession,
	selectNode,
	selectProfile,
} from './state-engine.js';
export {
	diagnostic,
	stateErr,
	stateOk,
	type StateDiagnostic,
	type StateEngineEvent,
	type StateEngineResult,
} from './types.js';
