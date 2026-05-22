/**
 * LOGOS Core — Filesystem helpers module.
 *
 * Provides path safety, redaction, and write-plan utilities.
 * Boundary: must not import Pi, Ink, React, TUI, or CLI modules.
 */

export type CoreFsModule = 'core.fs';

export * from './path-safety.js';
export * from './redaction.js';
export * from './write-plan.js';
