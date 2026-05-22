/**
 * LOGOS Core — Save config.
 *
 * Writes .logos/config.yml through the filesystem port, ensuring the
 * target path is inside the project root.
 * Boundary: must not import Pi, Ink, React, TUI, or CLI modules.
 */

import { checkPathInsideProject } from '../fs/path-safety.js';
import type { LogosFilesystem } from '../ports/filesystem.js';
import { getLogosConfigPath, getLogosRuntimeDir } from './config-paths.js';
import type { LogosConfig } from './config-schema.js';
import { stringifyLogosConfig } from './yaml-serialization.js';

export type { LogosConfig } from './config-schema.js';

export type SaveLogosConfigInput = {
	projectRoot: string;
	filesystem: LogosFilesystem;
	config: LogosConfig;
};

/**
 * Persist a LogosConfig to .logos/config.yml.
 *
 * - Ensures the .logos/ directory exists.
 * - Validates that the config path is inside projectRoot using
 *   {@link checkPathInsideProject}.
 * - Writes YAML to .logos/config.yml, overwriting any existing file.
 * - Throws if the path would escape the project root.
 */
export async function saveLogosConfig(
	input: SaveLogosConfigInput,
): Promise<void> {
	const { projectRoot, filesystem, config } = input;
	const runtimeDir = getLogosRuntimeDir(projectRoot);
	const configPath = getLogosConfigPath(projectRoot);

	// Verify path is contained inside project root.
	const safetyResult = checkPathInsideProject({
		projectRoot,
		targetPath: configPath,
	});

	if (!safetyResult.safe) {
		throw new Error(
			`Cannot save config outside project root: ${safetyResult.reason}`,
		);
	}

	// Ensure .logos/ directory exists.
	await filesystem.ensureDirectory(runtimeDir);

	// Write config as YAML.
	const yamlContent = stringifyLogosConfig(config);
	await filesystem.writeTextFile({
		content: yamlContent,
		overwrite: true,
		path: configPath,
		reason: 'saveLogosConfig',
	});
}
