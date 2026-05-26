/**
 * Profile registry — scans and retrieves profiles from the filesystem.
 *
 * `listProfiles()` returns available profile ID basenames.
 * `getProfile(id)` loads and validates a specific profile.
 *
 * The default profile directory can be overridden (useful for tests).
 */
import { existsSync, readdirSync } from 'node:fs';
import { basename, extname, join, resolve } from 'node:path';

import type { LogosProfile } from '../contracts/index.js';
import type { ProfileId } from '../shared/index.js';
import { err, LogosError, type Result } from '../shared/index.js';
import { type LoadError, loadProfile } from './profile-loader.js';

// ─── Constants ──────────────────────────────────────────────────────────────

/** Default directory scanned for profile files. */
export const DEFAULT_PROFILE_DIRECTORY = resolve(process.cwd(), 'profiles');

/** File extensions recognised as profile files. */
const PROFILE_EXTENSIONS = new Set(['.yml', '.yaml', '.json']);

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Return the basename without extension (the profile "id").
 */
function profileIdFromFileName(fileName: string): ProfileId {
	const ext = extname(fileName);
	const base = basename(fileName, ext);
	return base as ProfileId;
}

/**
 * Check whether a filename has a recognised profile extension.
 */
function isProfileFile(fileName: string): boolean {
	const ext = extname(fileName).toLowerCase();
	return PROFILE_EXTENSIONS.has(ext);
}

/**
 * Find an existing profile file for the given ID.
 *
 * Tries `${id}.yaml`, `${id}.yml`, `${id}.json` in order.
 * Returns the first match, or `null` if none found.
 */
function findProfileFile(directory: string, id: ProfileId): string | null {
	const candidates = [`${id}.yaml`, `${id}.yml`, `${id}.json`];
	for (const candidate of candidates) {
		const fullPath = join(directory, candidate);
		if (existsSync(fullPath)) {
			return fullPath;
		}
	}
	return null;
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * List all available profile IDs in the given directory.
 *
 * Scans for direct files with `.yml`, `.yaml`, or `.json` extensions.
 * Returns the basenames (without extensions) as `ProfileId[]`.
 *
 * @param profileDirectory - Directory to scan (default: `profiles/` in CWD).
 * @returns Array of profile IDs, sorted alphabetically.
 */
export function listProfiles(
	profileDirectory: string = DEFAULT_PROFILE_DIRECTORY,
): ProfileId[] {
	if (!existsSync(profileDirectory)) {
		return [];
	}

	const entries = readdirSync(profileDirectory, { withFileTypes: true });
	const ids: ProfileId[] = [];

	for (const entry of entries) {
		if (entry.isFile() && isProfileFile(entry.name)) {
			ids.push(profileIdFromFileName(entry.name));
		}
	}

	return ids.sort();
}

/**
 * Load and validate a profile by its ID.
 *
 * Searches for `${id}.yaml`, `${id}.yml`, or `${id}.json` in the given
 * directory and delegates to `loadProfile()` for parsing and validation.
 *
 * @param id - The profile ID (matches the filename without extension).
 * @param profileDirectory - Directory to search (default: `profiles/` in CWD).
 * @returns `Result<LogosProfile, LoadError>` — never throws.
 */
export function getProfile(
	id: ProfileId,
	profileDirectory: string = DEFAULT_PROFILE_DIRECTORY,
): Result<LogosProfile, LoadError> {
	const filePath = findProfileFile(profileDirectory, id);

	if (filePath === null) {
		return err(
			new LogosError(
				'LOGOS_PROFILE_FILE_NOT_FOUND',
				'profile_schema',
				`Profile "${id}" not found in ${profileDirectory}`,
				{
					details: { profileDirectory, profileId: id },
					recoverable: false,
				},
			),
		);
	}

	return loadProfile(filePath);
}
