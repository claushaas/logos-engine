/**
 * LOGOS Core — Intake state persistence.
 *
 * JSON serialization, path helpers, and filesystem-based load/save
 * for durable intake state.
 * Boundary: must not import Pi, Ink, React, TUI, or CLI modules.
 */

import path from 'node:path';
import { getLogosRuntimeDir } from '../config/config-paths.js';
import { checkPathInsideProject } from '../fs/path-safety.js';
import type { LogosFilesystem } from '../ports/filesystem.js';
import { createDefaultIntakeState } from './intake-state-defaults.js';
import { normalizeIntakeState } from './intake-state-schema.js';
import type { LogosIntakeState } from './intake-state-types.js';

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

export const LOGOS_INTAKE_STATE_FILE_NAME = 'intake-state.json';

export function getLogosIntakeStatePath(projectRoot: string): string {
	return path.join(
		getLogosRuntimeDir(projectRoot),
		LOGOS_INTAKE_STATE_FILE_NAME,
	);
}

// ---------------------------------------------------------------------------
// JSON serialization
// ---------------------------------------------------------------------------

export function parseIntakeStateJson(input: {
	content: string;
	projectRoot: string;
	now: string;
}):
	| { ok: true; state: LogosIntakeState; warnings: string[] }
	| { ok: false; errors: string[]; warnings: string[] } {
	let parsed: unknown;
	try {
		parsed = JSON.parse(input.content);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return {
			errors: [`Failed to parse intake state JSON: ${message}`],
			ok: false,
			warnings: [],
		};
	}

	return normalizeIntakeState({
		now: input.now,
		projectRoot: input.projectRoot,
		raw: parsed,
	});
}

export function stringifyIntakeState(state: LogosIntakeState): string {
	return JSON.stringify(state, null, 2);
}

// ---------------------------------------------------------------------------
// Filesystem load / save
// ---------------------------------------------------------------------------

export type LoadIntakeStateInput = {
	projectRoot: string;
	filesystem: LogosFilesystem;
	now: string;
};

export type LoadIntakeStateResult =
	| {
			ok: true;
			state: LogosIntakeState;
			createdDefault: boolean;
			warnings: string[];
	  }
	| {
			ok: false;
			errors: string[];
			warnings: string[];
	  };

/**
 * Load intake state from .logos/intake-state.json.
 *
 * - If the file does not exist, returns a default state with
 *   `createdDefault: true`.
 * - If the file exists, parses and normalizes its JSON content.
 * - Does **not** write the default file during load.
 */
export async function loadIntakeState(
	input: LoadIntakeStateInput,
): Promise<LoadIntakeStateResult> {
	const { projectRoot, filesystem, now } = input;
	const statePath = getLogosIntakeStatePath(projectRoot);

	const exists = await filesystem.fileExists({ path: statePath });

	if (!exists) {
		const state = createDefaultIntakeState({ now, projectRoot });
		return {
			createdDefault: true,
			ok: true,
			state,
			warnings: [
				`No intake state file found at ${statePath}, using default state.`,
			],
		};
	}

	let content: string;
	try {
		const readResult = await filesystem.readTextFile(statePath);
		content = readResult.content;
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return {
			errors: [`Failed to read intake state file: ${message}`],
			ok: false,
			warnings: [],
		};
	}

	const parseResult = parseIntakeStateJson({ content, now, projectRoot });
	if (!parseResult.ok) {
		return {
			errors: parseResult.errors,
			ok: false,
			warnings: parseResult.warnings,
		};
	}

	return {
		createdDefault: false,
		ok: true,
		state: parseResult.state,
		warnings: parseResult.warnings,
	};
}

export type SaveIntakeStateInput = {
	projectRoot: string;
	filesystem: LogosFilesystem;
	state: LogosIntakeState;
};

/**
 * Persist a LogosIntakeState to .logos/intake-state.json.
 *
 * - Ensures the .logos/ directory exists.
 * - Validates that the state path is inside projectRoot using
 *   {@link checkPathInsideProject}.
 * - Writes stable JSON with two-space indentation.
 * - Throws if the path would escape the project root.
 */
export async function saveIntakeState(
	input: SaveIntakeStateInput,
): Promise<void> {
	const { projectRoot, filesystem, state } = input;
	const runtimeDir = getLogosRuntimeDir(projectRoot);
	const statePath = getLogosIntakeStatePath(projectRoot);

	// Verify path is contained inside project root.
	const safetyResult = checkPathInsideProject({
		projectRoot,
		targetPath: statePath,
	});

	if (!safetyResult.safe) {
		throw new Error(
			`Cannot save intake state outside project root: ${safetyResult.reason}`,
		);
	}

	// Ensure .logos/ directory exists.
	await filesystem.ensureDirectory(runtimeDir);

	// Write state as stable JSON.
	const jsonContent = stringifyIntakeState(state);
	await filesystem.writeTextFile({
		content: jsonContent,
		overwrite: true,
		path: statePath,
		reason: 'saveIntakeState',
	});
}
