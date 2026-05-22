/**
 * LOGOS Core — Config schema.
 *
 * Defines the canonical LOGOS config contract, profile ID validation,
 * and config normalization. All types are plain serializable data.
 * Boundary: must not import Pi, Ink, React, TUI, or CLI modules.
 */

export const DEFAULT_PROFILE_ID = 'standard';

export const PROFILE_ID_MAX_LENGTH = 80;

const PROFILE_ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

// ---------------------------------------------------------------------------
// Profile ID validation
// ---------------------------------------------------------------------------

export type ProfileIdValidationResult =
	| { valid: true; profileId: string }
	| {
			valid: false;
			profileId: string;
			reason:
				| 'empty'
				| 'too_long'
				| 'invalid_format'
				| 'path_traversal'
				| 'reserved';
	  };

/**
 * Validate a profile ID against the allowed syntax rules.
 *
 * Allowed pattern: lowercase letters, digits, and hyphens, starting with
 * a letter or digit. Maximum length is {@link PROFILE_ID_MAX_LENGTH}.
 *
 * This validation is deterministic and does not check filesystem existence;
 * full profile existence validation happens in Step 2.2.
 */
export function validateProfileId(
	profileId: string,
): ProfileIdValidationResult {
	if (profileId.length === 0) {
		return { profileId, reason: 'empty', valid: false };
	}

	if (profileId.length > PROFILE_ID_MAX_LENGTH) {
		return { profileId, reason: 'too_long', valid: false };
	}

	// Reject path traversal characters
	if (
		profileId.includes('/') ||
		profileId.includes('\\') ||
		profileId.includes(':') ||
		profileId.includes('\0')
	) {
		return { profileId, reason: 'path_traversal', valid: false };
	}

	// Reject dots that could indicate hidden files or traversal
	if (profileId.startsWith('.') || profileId.includes('..')) {
		return { profileId, reason: 'path_traversal', valid: false };
	}

	// Reject whitespace
	if (profileId !== profileId.trim()) {
		return { profileId, reason: 'invalid_format', valid: false };
	}

	if (!PROFILE_ID_PATTERN.test(profileId)) {
		return { profileId, reason: 'invalid_format', valid: false };
	}

	return { profileId, valid: true };
}

// ---------------------------------------------------------------------------
// Config normalization
// ---------------------------------------------------------------------------

export type RawLogosConfig = Partial<LogosConfig> & Record<string, unknown>;

export type LogosConfigVersion = 1;

export type LogosConfig = {
	version: LogosConfigVersion;
	activeProfileId: string;
	createdAt: string;
	updatedAt: string;
	metadata?: Record<string, unknown>;
};

export type NormalizeLogosConfigInput = {
	raw: unknown;
	now: string;
};

export type NormalizeLogosConfigResult =
	| { ok: true; config: LogosConfig; warnings: string[] }
	| { ok: false; errors: string[] };

/**
 * Normalize raw config data into a validated LogosConfig.
 *
 * - Defaults missing `activeProfileId` to `"standard"`.
 * - Defaults missing `version` to `1`.
 * - Validates `activeProfileId` syntax.
 * - Defaults missing `createdAt` / `updatedAt` to `now`.
 * - Rejects non-object metadata.
 * - Rejects unsupported version values.
 */
export function normalizeLogosConfig(
	input: NormalizeLogosConfigInput,
): NormalizeLogosConfigResult {
	const { raw, now } = input;

	if (
		raw === null ||
		raw === undefined ||
		typeof raw !== 'object' ||
		Array.isArray(raw)
	) {
		return { errors: ['Config must be a plain object.'], ok: false };
	}

	const rawObj = raw as Record<string, unknown>;
	const warnings: string[] = [];

	// --- version ---
	const rawVersion = rawObj.version;
	if (rawVersion !== undefined && rawVersion !== 1) {
		return {
			errors: [`Unsupported config version: ${String(rawVersion)}.`],
			ok: false,
		};
	}

	// --- activeProfileId ---
	const rawActiveProfileId = rawObj.activeProfileId;
	let activeProfileId: string;
	if (rawActiveProfileId === undefined || rawActiveProfileId === null) {
		activeProfileId = DEFAULT_PROFILE_ID;
		warnings.push('activeProfileId missing, defaulting to "standard".');
	} else if (typeof rawActiveProfileId !== 'string') {
		return {
			errors: ['activeProfileId must be a string.'],
			ok: false,
		};
	} else {
		activeProfileId = rawActiveProfileId;
	}

	const validationResult = validateProfileId(activeProfileId);
	if (!validationResult.valid) {
		return {
			errors: [
				`Invalid activeProfileId "${activeProfileId}": ${validationResult.reason}.`,
			],
			ok: false,
		};
	}

	// --- createdAt ---
	const rawCreatedAt = rawObj.createdAt;
	let createdAt: string;
	if (typeof rawCreatedAt === 'string' && rawCreatedAt.length > 0) {
		createdAt = rawCreatedAt;
	} else {
		createdAt = now;
		warnings.push('createdAt missing or invalid, defaulting to now.');
	}

	// --- updatedAt ---
	const rawUpdatedAt = rawObj.updatedAt;
	let updatedAt: string;
	if (typeof rawUpdatedAt === 'string' && rawUpdatedAt.length > 0) {
		updatedAt = rawUpdatedAt;
	} else {
		updatedAt = now;
		warnings.push('updatedAt missing or invalid, defaulting to now.');
	}

	// --- metadata ---
	const rawMetadata = rawObj.metadata;
	let metadata: Record<string, unknown> | undefined;
	if (rawMetadata !== undefined && rawMetadata !== null) {
		if (typeof rawMetadata !== 'object' || Array.isArray(rawMetadata)) {
			return {
				errors: ['metadata must be a plain object if present.'],
				ok: false,
			};
		}
		metadata = rawMetadata as Record<string, unknown>;
	}

	const config: LogosConfig = {
		activeProfileId,
		createdAt,
		updatedAt,
		version: 1,
	};
	if (metadata !== undefined) {
		config.metadata = metadata;
	}

	return { config, ok: true, warnings };
}
