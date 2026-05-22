/**
 * LOGOS Core — Profile resolver.
 *
 * Maps an `activeProfileId` to a repository-local profile directory at
 * `profiles/<profile-id>/` and validates required top-level contracts.
 *
 * In Step 2.2 this only validates existence and shape; full contract
 * loading and parsing happens in Step 2.3.
 *
 * Boundary: must not import Pi, Ink, React, TUI, or CLI modules.
 */

import path from 'node:path';

import { validateProfileId } from '../config/config-schema.js';
import { checkPathInsideProject } from '../fs/path-safety.js';
import type { LogosFilesystem } from '../ports/filesystem.js';
import {
	getStandardRequiredPaths,
	validateProfileRequiredPaths,
} from './profile-contracts.js';
import {
	profileIdInvalid,
	profileNotFound,
	profilePathUnsafe,
} from './profile-errors.js';

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

/** Repository-local directory name for profile storage. */
export const PROFILES_DIR_NAME = 'profiles';

/**
 * Compute the absolute path of the `profiles/` directory inside projectRoot.
 * Does not check existence.
 */
export function getProfilesRoot(projectRoot: string): string {
	return path.join(projectRoot, PROFILES_DIR_NAME);
}

/**
 * Compute the absolute path of a specific profile directory.
 * Does not check existence.
 */
export function getProfileRoot(input: {
	projectRoot: string;
	profileId: string;
}): string {
	return path.join(input.projectRoot, PROFILES_DIR_NAME, input.profileId);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ProfileId = string;

export type ResolvedProfile = {
	profileId: ProfileId;
	profileRoot: string;
	docsPath: string;
	documentSchemaPath: string;
	phasesRoot: string;
	executiveRoot: string;
};

export type ProfileResolutionErrorCode =
	| 'profile_not_found'
	| 'profile_invalid'
	| 'profile_path_unsafe'
	| 'profile_id_invalid';

export type ProfileResolutionError = {
	code: ProfileResolutionErrorCode;
	message: string;
	details?: string;
	path?: string;
};

export type ResolveProfileResult =
	| {
			ok: true;
			profile: ResolvedProfile;
			warnings: string[];
	  }
	| {
			ok: false;
			errors: ProfileResolutionError[];
			warnings: string[];
	  };

// ---------------------------------------------------------------------------
// Input type
// ---------------------------------------------------------------------------

export type ResolveActiveProfileInput = {
	/** Absolute path of the project root. */
	projectRoot: string;
	/** The active profile id (already read from config and defaulted). */
	activeProfileId: string;
	/** Filesystem port for existence checks. */
	filesystem: LogosFilesystem;
};

// ---------------------------------------------------------------------------
// Directory existence helper
// ---------------------------------------------------------------------------

/**
 * Check whether a directory exists by attempting to list it.
 * If {@link LogosFilesystem.listDirectory} throws, the directory
 * is treated as non-existent. An empty listing is treated as
 * existence.
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
// Resolver
// ---------------------------------------------------------------------------

/**
 * Resolve an active profile id to a repository-local profile directory
 * and validate required top-level contracts.
 *
 * Performs these checks in order:
 * 1. Validates the profile id syntax defensively.
 * 2. Computes and validates the resolved profile path inside the project root.
 * 3. Checks whether the profile directory exists.
 * 4. Validates required file/directory contracts.
 *
 * On success returns `{ ok: true, profile, warnings }`.
 * On failure returns `{ ok: false, errors, warnings }`.
 *
 * Does **not** throw for normal resolution failures.
 */
export async function resolveActiveProfile(
	input: ResolveActiveProfileInput,
): Promise<ResolveProfileResult> {
	const { projectRoot, activeProfileId, filesystem } = input;

	const warnings: string[] = [];

	// ---- 1. Validate profile id syntax ----
	const idValidation = validateProfileId(activeProfileId);
	if (!idValidation.valid) {
		return {
			errors: [profileIdInvalid(activeProfileId, idValidation.reason)],
			ok: false,
			warnings,
		};
	}

	// ---- 2. Compute and validate the profile path ----
	const profileRoot = getProfileRoot({
		profileId: activeProfileId,
		projectRoot,
	});

	const pathSafety = checkPathInsideProject({
		projectRoot,
		targetPath: profileRoot,
	});
	if (!pathSafety.safe) {
		return {
			errors: [profilePathUnsafe(activeProfileId, profileRoot)],
			ok: false,
			warnings,
		};
	}

	// ---- 3. Check profile directory existence ----
	const dirExists = await directoryExists(filesystem, profileRoot);
	if (!dirExists) {
		return {
			errors: [profileNotFound(activeProfileId, profileRoot)],
			ok: false,
			warnings,
		};
	}

	// ---- 4. Validate required contracts ----
	const requiredPaths = getStandardRequiredPaths(profileRoot);
	const contractErrors = await validateProfileRequiredPaths({
		filesystem,
		requiredPaths,
	});

	if (contractErrors.length > 0) {
		return {
			errors: contractErrors,
			ok: false,
			warnings,
		};
	}

	// ---- Success ----
	const profile: ResolvedProfile = {
		docsPath: path.join(profileRoot, 'docs.yml'),
		documentSchemaPath: path.join(profileRoot, 'document.schema.yml'),
		executiveRoot: path.join(profileRoot, 'executive'),
		phasesRoot: path.join(profileRoot, 'phases'),
		profileId: activeProfileId,
		profileRoot,
	};

	return {
		ok: true,
		profile,
		warnings,
	};
}
