/**
 * LOGOS Core — Load config.
 *
 * Loads .logos/config.yml through the filesystem port, returning a
 * validated LogosConfig. If the file does not exist a default config
 * is returned without writing.
 * Boundary: must not import Pi, Ink, React, TUI, or CLI modules.
 */

import type { LogosFilesystem } from '../ports/filesystem.js';
import { createDefaultLogosConfig } from '../state/config-types.js';
import { getLogosConfigPath } from './config-paths.js';
import type { LogosConfig } from './config-schema.js';
import { parseLogosConfigYaml } from './yaml-serialization.js';

export type { LogosConfig } from './config-schema.js';

export type LoadLogosConfigInput = {
	projectRoot: string;
	filesystem: LogosFilesystem;
	now: string;
};

export type LoadLogosConfigResult =
	| {
			ok: true;
			config: LogosConfig;
			createdDefault: boolean;
			warnings: string[];
	  }
	| { ok: false; errors: string[] };

/**
 * Load the LOGOS config from .logos/config.yml.
 *
 * - If the file does not exist, returns a default config with
 *   `activeProfileId: "standard"` and `createdDefault: true`.
 * - If the file exists, parses and normalizes its YAML content.
 * - Validates profile ID syntax; does **not** validate profile directory
 *   existence (that happens in Step 2.2).
 * - Does **not** write the default config during load.
 */
export async function loadLogosConfig(
	input: LoadLogosConfigInput,
): Promise<LoadLogosConfigResult> {
	const { projectRoot, filesystem, now } = input;
	const configPath = getLogosConfigPath(projectRoot);

	const exists = await filesystem.fileExists({ path: configPath });

	if (!exists) {
		const config = createDefaultLogosConfig({ now });
		return {
			config,
			createdDefault: true,
			ok: true,
			warnings: [
				`No config file found at ${configPath}, using default config.`,
			],
		};
	}

	let content: string;
	try {
		const readResult = await filesystem.readTextFile(configPath);
		content = readResult.content;
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return {
			errors: [`Failed to read config file: ${message}`],
			ok: false,
		};
	}

	const parseResult = parseLogosConfigYaml(content, now);
	if (!parseResult.ok) {
		return { errors: parseResult.errors, ok: false };
	}

	return {
		config: parseResult.config,
		createdDefault: false,
		ok: true,
		warnings: parseResult.warnings,
	};
}
