/**
 * LOGOS Core — Profile contracts validation.
 *
 * Defines required profile paths and a validation helper that checks
 * file/directory existence against a {@link LogosFilesystem} port.
 *
 * In Step 2.2 this only validates existence; full contract loading and
 * parsing happens in Step 2.3.
 */

import type { LogosFilesystem } from '../ports/filesystem.js';
import { createProfileResolutionError } from './profile-errors.js';
import type { ProfileResolutionError } from './profile-resolver.js';

// ---------------------------------------------------------------------------
// Required path types
// ---------------------------------------------------------------------------

export type ProfileRequiredPath = {
	/** Absolute path to check. */
	path: string;
	/** Whether this path refers to a file or a directory. */
	kind: 'file' | 'directory';
	/** Human-readable label used in error messages. */
	label: string;
};

// ---------------------------------------------------------------------------
// Required Standard-profile paths
// ---------------------------------------------------------------------------

/**
 * Returns the list of required top-level paths that every profile
 * must provide. Derived from the Standard profile contract shape.
 *
 * Paths are computed as absolute paths from the given `profileRoot`.
 */
export function getStandardRequiredPaths(
	profileRoot: string,
): ProfileRequiredPath[] {
	return [
		{ kind: 'file', label: 'docs.yml', path: `${profileRoot}/docs.yml` },
		{
			kind: 'file',
			label: 'document.schema.yml',
			path: `${profileRoot}/document.schema.yml`,
		},
		{ kind: 'directory', label: 'phases/', path: `${profileRoot}/phases` },
		{
			kind: 'directory',
			label: 'executive/',
			path: `${profileRoot}/executive`,
		},
		{
			kind: 'file',
			label: 'executive/executive-generation.yml',
			path: `${profileRoot}/executive/executive-generation.yml`,
		},
		{
			kind: 'file',
			label: 'executive/executive-plan.schema.json',
			path: `${profileRoot}/executive/executive-plan.schema.json`,
		},
		{
			kind: 'directory',
			label: 'executive/mappings/',
			path: `${profileRoot}/executive/mappings`,
		},
		{
			kind: 'directory',
			label: 'executive/templates/',
			path: `${profileRoot}/executive/templates`,
		},
	];
}

// ---------------------------------------------------------------------------
// Directory existence helper
// ---------------------------------------------------------------------------

/**
 * Check whether a directory exists via the filesystem port.
 *
 * Tries {@link LogosFilesystem.listDirectory}; if the call throws
 * the directory is treated as non-existent. An empty listing is
 * treated as existence (the directory may simply be empty).
 */
async function directoryExists(
	filesystem: LogosFilesystem,
	dirPath: string,
): Promise<boolean> {
	try {
		await filesystem.listDirectory({ path: dirPath });
		return true;
	} catch {
		return false;
	}
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validate that all required profile paths exist.
 *
 * - For **files**, uses {@link LogosFilesystem.fileExists}.
 * - For **directories**, uses {@link directoryExists} which calls
 *   {@link LogosFilesystem.listDirectory} and treats a thrown error
 *   as non-existence.
 *
 * Returns an empty array when every required path exists.
 */
export async function validateProfileRequiredPaths(input: {
	filesystem: LogosFilesystem;
	requiredPaths: ProfileRequiredPath[];
}): Promise<ProfileResolutionError[]> {
	const { filesystem, requiredPaths } = input;
	const errors: ProfileResolutionError[] = [];

	for (const entry of requiredPaths) {
		let exists: boolean;
		if (entry.kind === 'file') {
			exists = await filesystem.fileExists({ path: entry.path });
		} else {
			exists = await directoryExists(filesystem, entry.path);
		}

		if (!exists) {
			errors.push(
				createProfileResolutionError(
					'profile_invalid',
					`Missing required ${entry.kind}: ${entry.label}`,
					{
						details: `Expected ${entry.kind} at "${entry.path}".`,
						path: entry.path,
					},
				),
			);
		}
	}

	return errors;
}
