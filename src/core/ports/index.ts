/**
 * LOGOS Core — Ports module.
 *
 * Defines filesystem, state repository, and evaluator ports that keep Core deterministic and testable.
 * Boundary: must not import Pi, Ink, React, TUI, or CLI modules.
 */

export type CorePortsModule = 'core.ports';
