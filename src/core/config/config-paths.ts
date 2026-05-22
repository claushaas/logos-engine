/**
 * LOGOS Core — Config path helpers.
 *
 * Centralised constants and functions for LOGOS runtime paths.
 * These functions only compute paths; they do not create directories.
 * Boundary: must not import Pi, Ink, React, TUI, or CLI modules.
 */

import path from 'node:path';

export const LOGOS_RUNTIME_DIR = '.logos';

export const LOGOS_CONFIG_FILE_NAME = 'config.yml';

/**
 * Compute the absolute path of the .logos/ runtime directory inside projectRoot.
 */
export function getLogosRuntimeDir(projectRoot: string): string {
	return path.join(projectRoot, LOGOS_RUNTIME_DIR);
}

/**
 * Compute the absolute path of .logos/config.yml inside projectRoot.
 */
export function getLogosConfigPath(projectRoot: string): string {
	return path.join(projectRoot, LOGOS_RUNTIME_DIR, LOGOS_CONFIG_FILE_NAME);
}
