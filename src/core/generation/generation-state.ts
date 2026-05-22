/**
 * LOGOS Core — Generation state persistence (Step 6.2).
 *
 * JSON serialization, path helpers, and filesystem-based load/save
 * for durable generation state.
 *
 * Boundary: must not import Pi, Ink, React, TUI, or CLI modules.
 */

import path from 'node:path';
import { getLogosRuntimeDir } from '../config/config-paths.js';
import { checkPathInsideProject } from '../fs/path-safety.js';
import type { LogosFilesystem } from '../ports/filesystem.js';
import type {
	GenerationPreflightSnapshot,
	GenerationState,
} from '../state/generation-state-types.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const LOGOS_GENERATION_STATE_FILE_NAME = 'generation-state.json';

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

export function getLogosGenerationStatePath(projectRoot: string): string {
	return path.join(
		getLogosRuntimeDir(projectRoot),
		LOGOS_GENERATION_STATE_FILE_NAME,
	);
}

// ---------------------------------------------------------------------------
// Default generation state
// ---------------------------------------------------------------------------

export function createDefaultGenerationState(input: {
	projectRoot: string;
	now: string;
}): GenerationState {
	return {
		generatedPaths: [],
		initializedAt: input.now,
		projectRoot: input.projectRoot,
		updatedAt: input.now,
	};
}

// ---------------------------------------------------------------------------
// JSON serialization
// ---------------------------------------------------------------------------

export type ParseGenerationStateJsonInput = {
	content: string;
	projectRoot: string;
	now: string;
};

export type ParseGenerationStateJsonResult =
	| { ok: true; state: GenerationState; warnings: string[] }
	| { ok: false; errors: string[] };

/**
 * Parse and normalize a generation state JSON blob.
 *
 * - Accepts a valid JSON object.
 * - Coerces `projectRoot` to the expected value.
 * - Sets `initializedAt` / `updatedAt` to defaults when missing.
 * - Accepts any valid `lastPreflight` shape; does not deeply validate it.
 */
export function parseGenerationStateJson(
	input: ParseGenerationStateJsonInput,
): ParseGenerationStateJsonResult {
	let parsed: unknown;
	try {
		parsed = JSON.parse(input.content);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return {
			errors: [`Failed to parse generation state JSON: ${message}`],
			ok: false,
		};
	}

	if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
		return {
			errors: ['Generation state must be a JSON object.'],
			ok: false,
		};
	}

	const obj = parsed as Record<string, unknown>;
	const warnings: string[] = [];

	// --- initializedAt ---
	const initializedAt =
		typeof obj.initializedAt === 'string' && obj.initializedAt.length > 0
			? obj.initializedAt
			: input.now;

	if (initializedAt === input.now && typeof obj.initializedAt !== 'string') {
		warnings.push('initializedAt missing or invalid, defaulting to now.');
	}

	// --- updatedAt ---
	const updatedAt =
		typeof obj.updatedAt === 'string' && obj.updatedAt.length > 0
			? obj.updatedAt
			: input.now;

	if (updatedAt === input.now && typeof obj.updatedAt !== 'string') {
		warnings.push('updatedAt missing or invalid, defaulting to now.');
	}

	// --- lastPreflightAt ---
	let lastPreflightAt: string | undefined;
	if (
		typeof obj.lastPreflightAt === 'string' &&
		obj.lastPreflightAt.length > 0
	) {
		lastPreflightAt = obj.lastPreflightAt;
	}

	// --- lastGeneratedAt ---
	let lastGeneratedAt: string | undefined;
	if (
		typeof obj.lastGeneratedAt === 'string' &&
		obj.lastGeneratedAt.length > 0
	) {
		lastGeneratedAt = obj.lastGeneratedAt;
	}

	// --- generatedPaths ---
	let generatedPaths: string[] = [];
	const rawPaths = obj.generatedPaths;
	if (rawPaths !== undefined && rawPaths !== null) {
		if (Array.isArray(rawPaths)) {
			generatedPaths = rawPaths
				.filter((v): v is string => typeof v === 'string')
				.map((v) => v);
		} else {
			warnings.push('generatedPaths is not an array, defaulting to [].');
		}
	}

	// --- lastPreflight ---
	let lastPreflight: GenerationPreflightSnapshot | undefined;
	if (obj.lastPreflight !== undefined && obj.lastPreflight !== null) {
		if (
			typeof obj.lastPreflight === 'object' &&
			!Array.isArray(obj.lastPreflight)
		) {
			const lp = obj.lastPreflight as Record<string, unknown>;
			// Conservative coercion; only store fields we recognise.
			const snapshot: GenerationPreflightSnapshot = {
				blockerCodes: Array.isArray(lp.blockerCodes)
					? lp.blockerCodes.filter((v): v is string => typeof v === 'string')
					: [],
				checkedAt:
					typeof lp.checkedAt === 'string' && lp.checkedAt.length > 0
						? lp.checkedAt
						: input.now,
				completenessScore:
					typeof lp.completenessScore === 'number' ? lp.completenessScore : 0,
				mode:
					typeof lp.mode === 'string' && lp.mode.length > 0 ? lp.mode : 'final',
				ready: typeof lp.ready === 'boolean' ? lp.ready : false,
				status:
					typeof lp.status === 'string' && lp.status.length > 0
						? lp.status
						: 'blocked',
				warningCodes: Array.isArray(lp.warningCodes)
					? lp.warningCodes.filter((v): v is string => typeof v === 'string')
					: [],
			};
			lastPreflight = snapshot;
		} else {
			warnings.push('lastPreflight is not an object, ignoring.');
		}
	}

	// --- metadata ---
	let metadata: Record<string, unknown> | undefined;
	if (obj.metadata !== undefined && obj.metadata !== null) {
		if (typeof obj.metadata === 'object' && !Array.isArray(obj.metadata)) {
			metadata = obj.metadata as Record<string, unknown>;
		} else {
			warnings.push('metadata is not an object, ignoring.');
		}
	}

	const state: GenerationState = {
		generatedPaths,
		initializedAt,
		projectRoot: input.projectRoot,
		updatedAt,
	};

	if (lastPreflightAt !== undefined) {
		state.lastPreflightAt = lastPreflightAt;
	}
	if (lastGeneratedAt !== undefined) {
		state.lastGeneratedAt = lastGeneratedAt;
	}
	if (lastPreflight !== undefined) {
		state.lastPreflight = lastPreflight;
	}

	if (metadata !== undefined) {
		state.metadata = metadata;
	}

	return { ok: true, state, warnings };
}

/**
 * Serialize a {@link GenerationState} to stable JSON.
 */
export function stringifyGenerationState(state: GenerationState): string {
	return JSON.stringify(state, null, 2);
}

// ---------------------------------------------------------------------------
// Filesystem load / save
// ---------------------------------------------------------------------------

export type LoadGenerationStateInput = {
	projectRoot: string;
	filesystem: LogosFilesystem;
	now: string;
};

export type LoadGenerationStateResult =
	| {
			ok: true;
			state: GenerationState;
			createdDefault: boolean;
			warnings: string[];
	  }
	| { ok: false; errors: string[] };

/**
 * Load generation state from `.logos/generation-state.json`.
 *
 * - If the file does not exist, returns a default state with
 *   `createdDefault: true`.
 * - If the file exists, parses and normalizes its JSON content.
 * - Does **not** write the default file during load.
 */
export async function loadGenerationState(
	input: LoadGenerationStateInput,
): Promise<LoadGenerationStateResult> {
	const { projectRoot, filesystem, now } = input;
	const statePath = getLogosGenerationStatePath(projectRoot);

	const exists = await filesystem.fileExists({ path: statePath });

	if (!exists) {
		const state = createDefaultGenerationState({ now, projectRoot });
		return {
			createdDefault: true,
			ok: true,
			state,
			warnings: [
				`No generation state file found at ${statePath}, using default state.`,
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
			errors: [`Failed to read generation state file: ${message}`],
			ok: false,
		};
	}

	const parseResult = parseGenerationStateJson({ content, now, projectRoot });
	if (!parseResult.ok) {
		return { errors: parseResult.errors, ok: false };
	}

	return {
		createdDefault: false,
		ok: true,
		state: parseResult.state,
		warnings: parseResult.warnings,
	};
}

export type SaveGenerationStateInput = {
	projectRoot: string;
	filesystem: LogosFilesystem;
	state: GenerationState;
};

/**
 * Persist a {@link GenerationState} to `.logos/generation-state.json`.
 *
 * - Ensures the `.logos/` directory exists.
 * - Validates that the state path is inside `projectRoot`.
 * - Writes stable JSON with two-space indentation.
 * - Throws if the path would escape the project root.
 */
export async function saveGenerationState(
	input: SaveGenerationStateInput,
): Promise<void> {
	const { projectRoot, filesystem, state } = input;
	const runtimeDir = getLogosRuntimeDir(projectRoot);
	const statePath = getLogosGenerationStatePath(projectRoot);

	// Verify path is contained inside project root.
	const safetyResult = checkPathInsideProject({
		projectRoot,
		targetPath: statePath,
	});

	if (!safetyResult.safe) {
		throw new Error(
			`Cannot save generation state outside project root: ${safetyResult.reason}`,
		);
	}

	// Ensure .logos/ directory exists.
	await filesystem.ensureDirectory(runtimeDir);

	// Write state as stable JSON.
	const jsonContent = stringifyGenerationState(state);
	await filesystem.writeTextFile({
		content: jsonContent,
		overwrite: true,
		path: statePath,
		reason: 'saveGenerationState',
	});
}
