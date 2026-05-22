/**
 * LOGOS Core — YAML serialization helpers.
 *
 * Parse and stringify .logos/config.yml using the project's yaml dependency.
 * Boundary: must not import Pi, Ink, React, TUI, or CLI modules.
 */

import { parse as yamlParse, stringify as yamlStringify } from 'yaml';

import type { LogosConfig } from './config-schema.js';
import {
	DEFAULT_PROFILE_ID,
	type NormalizeLogosConfigResult,
	normalizeLogosConfig,
} from './config-schema.js';

export type { NormalizeLogosConfigResult } from './config-schema.js';

/**
 * Parse YAML content into a validated LogosConfig.
 * Delegates to {@link normalizeLogosConfig} after YAML parsing.
 */
export function parseLogosConfigYaml(
	content: string,
	now: string,
): NormalizeLogosConfigResult {
	let raw: unknown;
	try {
		raw = yamlParse(content);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return { errors: [`YAML parse error: ${message}`], ok: false };
	}

	if (raw === null || raw === undefined) {
		// Empty YAML document — produce default config.
		const config: LogosConfig = {
			activeProfileId: DEFAULT_PROFILE_ID,
			createdAt: now,
			updatedAt: now,
			version: 1,
		};
		return {
			config,
			ok: true,
			warnings: ['YAML document was empty, using default config.'],
		};
	}

	return normalizeLogosConfig({ now, raw });
}

/**
 * Serialize a LogosConfig to stable YAML.
 * Only includes defined fields (version, activeProfileId, createdAt, updatedAt,
 * and metadata when present).
 */
export function stringifyLogosConfig(config: LogosConfig): string {
	const record: Record<string, unknown> = {
		activeProfileId: config.activeProfileId,
		createdAt: config.createdAt,
		updatedAt: config.updatedAt,
		version: config.version,
	};

	if (config.metadata !== undefined) {
		record.metadata = config.metadata;
	}

	return yamlStringify(record);
}
