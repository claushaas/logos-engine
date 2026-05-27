/**
 * State engine module — deterministic runtime state management.
 *
 * The state engine owns all runtime state. Every mutation passes through
 * pure functions that return new state objects. The TUI and application
 * layer consume derived snapshots — never raw state directly.
 *
 * Exports:
 * - Event dispatch (primary API): `dispatch`, `LogosEvent`,
 *   `StateEngineEvent`
 * - Snapshot builder: `buildSnapshot`, `StateEngineSnapshot`
 * - State engine operations: `createSession`, `selectProfile`,
 *   `changeProfile`, `selectNode`, `applyLifecycleTransition`
 * - Lifecycle validation: `isValidTransition`, `allLifecycles`
 * - Allowed actions: `getAllowedActions`, `isActionAllowed`
 * - Completeness evaluation: `evaluateCompleteness`
 * - Document readiness: `computeDocumentReadiness`,
 *   `recomputeAllDocumentReadiness`
 * - Session mode resolution: `resolveSessionMode`,
 *   `resolveSessionModeWithDiagnostics`, `SessionModeResolution`
 * - Type helpers: `StateEngineResult`, `StateDiagnostic`,
 *   `StateEngineEvent`, `diagnostic`, `stateOk`, `stateErr`
 */

export {
	getAllowedActions,
	isActionAllowed,
} from './allowed-actions.js';
export { evaluateCompleteness } from './completeness.js';
export { dispatch } from './dispatch.js';
export {
	computeDocumentReadiness,
	recomputeAllDocumentReadiness,
} from './document-readiness.js';
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
export { buildSnapshot } from './snapshot-builder.js';
export { propagateStaleness } from './staleness.js';
export {
	changeProfile,
	createSession,
	deselectNode,
	selectNode,
	selectProfile,
} from './state-engine.js';
export {
	type DispatchEvent,
	diagnostic,
	type LogosEvent,
	type StateDiagnostic,
	type StateEngineEvent,
	type StateEngineResult,
	type StateEngineSnapshot,
	stateErr,
	stateOk,
} from './types.js';
