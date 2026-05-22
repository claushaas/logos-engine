/**
 * LOGOS Core — Profile error helpers.
 *
 * Defines helper functions for creating structured profile resolution errors.
 * These errors use the {@link ProfileResolutionError} shape defined in
 * {@link ./profile-resolver.js} and map to corresponding {@link LogosErrorCode}
 * values where applicable.
 */

import type {
	ProfileResolutionError,
	ProfileResolutionErrorCode,
} from './profile-resolver.js';

/**
 * Create a structured profile resolution error.
 */
export function createProfileResolutionError(
	code: ProfileResolutionErrorCode,
	message: string,
	options?: {
		details?: string | undefined;
		path?: string | undefined;
	},
): ProfileResolutionError {
	const error: ProfileResolutionError = { code, message };
	const details = options?.details;
	if (details !== undefined) {
		error.details = details;
	}
	const path = options?.path;
	if (path !== undefined) {
		error.path = path;
	}
	return error;
}

/**
 * Create a `profile_not_found` error.
 */
export function profileNotFound(
	profileId: string,
	profilePath: string,
): ProfileResolutionError {
	return createProfileResolutionError(
		'profile_not_found',
		`Profile "${profileId}" not found at "${profilePath}".`,
		{
			details: `No profile directory exists at profiles/${profileId}/. Run /logos-init to initialize.`,
			path: profilePath,
		},
	);
}

/**
 * Create a `profile_invalid` error.
 */
export function profileInvalid(
	message: string,
	details?: string | undefined,
	path?: string | undefined,
): ProfileResolutionError {
	const options: { details?: string | undefined; path?: string | undefined } =
		{};
	if (details !== undefined) {
		options.details = details;
	}
	if (path !== undefined) {
		options.path = path;
	}
	return createProfileResolutionError('profile_invalid', message, options);
}

/**
 * Create a `profile_path_unsafe` error.
 */
export function profilePathUnsafe(
	profileId: string,
	resolvedPath: string,
): ProfileResolutionError {
	return createProfileResolutionError(
		'profile_path_unsafe',
		`Profile path for "${profileId}" escapes the project root.`,
		{
			details: `Resolved path "${resolvedPath}" is outside the project root.`,
			path: resolvedPath,
		},
	);
}

/**
 * Create a `profile_id_invalid` error.
 */
export function profileIdInvalid(
	profileId: string,
	reason: string,
): ProfileResolutionError {
	return createProfileResolutionError(
		'profile_id_invalid',
		`Invalid profile ID "${profileId}".`,
		{
			details: reason,
		},
	);
}
