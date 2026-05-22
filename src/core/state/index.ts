/**
 * LOGOS Core — State module.
 *
 * Owns intake state schema, persistence ports, and state transitions.
 * Boundary: must not import Pi, Ink, React, TUI, or CLI modules.
 */

export type CoreStateModule = 'core.state';

export * from './config-types.js';
export * from './generation-state-types.js';
export * from './in-memory-state-repository.js';
export * from './intake-state-types.js';
