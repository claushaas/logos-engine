/**
 * Profiles module — profile loading, validation, and registry.
 *
 * Exports:
 * - `loadProfile(path)` — load and validate a single profile file.
 * - `listProfiles(dir?)` — scan a directory for profile IDs.
 * - `getProfile(id, dir?)` — load a profile by ID from a directory.
 * - `LoadError` — the error type returned by all load operations.
 * - `DEFAULT_PROFILE_DIRECTORY` — default scan directory.
 */

export { type LoadError, loadProfile } from './profile-loader.js';
export {
	DEFAULT_PROFILE_DIRECTORY,
	getProfile,
	listProfiles,
} from './profile-registry.js';
