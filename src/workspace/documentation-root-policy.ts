/**
 * Documentation Root Policy — path safety, normalization, and validation.
 *
 * Phase 6: Documentation Root Configuration — Outcome 4 (path safety).
 *
 * All functions are pure and deterministic. No filesystem access beyond
 * path inspection (symlink resolution is deferred to callers with
 * filesystem access). No provider calls, no network, no secrets.
 */

import { isAbsolute, relative, resolve } from 'node:path';
import type {
	DocumentationRootSafetyCheck,
	DocumentationRootSafetyResult,
} from './documentation-root-model.js';
import { DOCUMENTATION_ROOT_DIAGNOSTIC_CODES } from './documentation-root-model.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const DEFAULT_DOCUMENTATION_ROOT = 'logos/';

/** Reserved directory names that documentation root must not overlap */
export const RESERVED_DIR_NAMES = [
	'.git',
	'.logos',
	'node_modules',
	'dist',
	'build',
	'coverage',
	'.nyc_output',
	'backups',
	'.backups',
	'temp',
	'.temp',
	'tmp',
	'.tmp',
	'cache',
	'.cache',
] as const;

/** Reserved source/test directory names */
export const RESERVED_SOURCE_DIRS = [
	'src',
	'tests',
	'scripts',
	'profiles',
] as const;

/** Reserved package metadata file names */
export const RESERVED_PACKAGE_FILES = [
	'package.json',
	'pnpm-lock.yaml',
	'yarn.lock',
	'package-lock.json',
	'README.md',
	'SECURITY.md',
	'LICENSE',
	'CONTRIBUTING.md',
	'CHANGELOG.md',
	'tsconfig.json',
	'biome.json',
	'.gitignore',
	'.npmignore',
] as const;

/** Maximum entries to scan in collision checks */
export const COLLISION_SCAN_MAX_ENTRIES = 100;
/** Maximum depth to scan */
export const COLLISION_SCAN_MAX_DEPTH = 3;

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

/**
 * Normalize a path using forward slashes (cross-platform).
 */
export function normalizeSeparators(input: string): string {
	return (
		input.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/$/, '') || '.'
	);
}

/**
 * Normalize a path relative to a project root.
 * Returns the normalized relative path without leading ./ or trailing /.
 * Returns null if the path escapes the project root.
 */
export function normalizeDocumentationRootPath(
	inputPath: string,
	projectRoot: string,
): { normalized: string; isInsideProject: boolean; absolute: string } {
	const normalizedInput = normalizeSeparators(inputPath);
	const normalizedRoot = normalizeSeparators(projectRoot);

	let absolutePath: string;

	if (isAbsolute(inputPath)) {
		absolutePath = resolve(normalizedInput);
	} else {
		absolutePath = resolve(normalizedRoot, normalizedInput);
	}

	const normalizedAbsolute = normalizeSeparators(absolutePath);
	const normalizedProjectRoot = normalizeSeparators(resolve(normalizedRoot));

	const isInsideProject =
		normalizedAbsolute === normalizedProjectRoot ||
		normalizedAbsolute.startsWith(`${normalizedProjectRoot}/`);

	let relativePath: string;
	if (isInsideProject) {
		relativePath =
			normalizedAbsolute === normalizedProjectRoot
				? '.'
				: normalizedAbsolute.slice(normalizedProjectRoot.length + 1);
	} else {
		// Path is outside; compute relative for display but mark as unsafe
		try {
			relativePath = relative(normalizedRoot, absolutePath);
		} catch {
			relativePath = normalizedInput;
		}
	}

	// Normalize to forward slashes
	const normalized = normalizeSeparators(relativePath);

	return {
		absolute: normalizedAbsolute,
		isInsideProject,
		normalized,
	};
}

/**
 * Check if a path contains path traversal patterns (../ or ..\)
 */
export function hasTraversal(path: string): boolean {
	const segments = normalizeSeparators(path).split('/');
	return segments.includes('..');
}

/**
 * Check if a path matches or is inside one of the reserved directory names.
 */
export function matchesReservedDir(
	normalizedPath: string,
	_projectRoot: string,
): { matches: boolean; dir: string } {
	const segments = normalizedPath.split('/').filter(Boolean);
	const firstSegment = segments[0] ?? '';

	// Check first segment against reserved dir names
	for (const reserved of RESERVED_DIR_NAMES) {
		if (firstSegment === reserved) {
			return { dir: reserved, matches: true };
		}
	}

	// Check if the path is the project root itself (.)
	if (normalizedPath === '.' || normalizedPath === '') {
		return { dir: 'project_root', matches: true };
	}

	// Check against reserved source dirs
	for (const reserved of RESERVED_SOURCE_DIRS) {
		if (firstSegment === reserved) {
			return { dir: reserved, matches: true };
		}
	}

	// Check against reserved package files
	for (const reserved of RESERVED_PACKAGE_FILES) {
		if (
			normalizedPath === reserved ||
			(segments.length === 1 && segments[0] === reserved)
		) {
			return { dir: reserved, matches: true };
		}
	}

	return { dir: '', matches: false };
}

/**
 * Check if target path overlaps with a given directory or file.
 */
export function pathOverlaps(
	targetNormalized: string,
	otherNormalized: string,
): { isSame: boolean; isParent: boolean; isChild: boolean } {
	const t = targetNormalized || '.';
	const o = otherNormalized || '.';

	if (t === o) {
		return { isChild: false, isParent: false, isSame: true };
	}

	if (t.startsWith(`${o}/`)) {
		return { isChild: true, isParent: false, isSame: false };
	}

	if (o.startsWith(`${t}/`)) {
		return { isChild: false, isParent: true, isSame: false };
	}

	return { isChild: false, isParent: false, isSame: false };
}

// ---------------------------------------------------------------------------
// Safety validation
// ---------------------------------------------------------------------------

export interface ValidateDocumentationRootOptions {
	/** Normalized relative path from normalizeDocumentationRootPath */
	normalizedPath: string;
	/** Whether path is inside project root */
	isInsideProject: boolean;
	/** Whether path came from an absolute input */
	isAbsoluteInput: boolean;
	/** Project root path (for overlap checks) */
	projectRoot: string;
	/** Active profile root path relative to project root (if custom) */
	activeProfileRoot?: string | undefined;
	/** Current documentation root path (for overlap checks) */
	currentDocumentationRoot?: string | undefined;
	/** Whether strict overlap checks are enabled */
	strictOverlapCheck?: boolean | undefined;
}

/**
 * Validate a proposed documentation root path for safety.
 * Pure function — no filesystem access.
 * Returns a safety result with individual check details.
 */
export function validateDocumentationRootPath(
	options: ValidateDocumentationRootOptions,
): DocumentationRootSafetyResult {
	const checks: DocumentationRootSafetyCheck[] = [];
	const {
		normalizedPath,
		isInsideProject,
		isAbsoluteInput,
		projectRoot,
		activeProfileRoot,
		currentDocumentationRoot,
		strictOverlapCheck = true,
	} = options;

	// 1. Traversal check
	const traversalDetected = hasTraversal(normalizedPath);
	checks.push({
		code: DOCUMENTATION_ROOT_DIAGNOSTIC_CODES.ROOT_PATH_TRAVERSAL,
		message: traversalDetected
			? `Documentation root path "${normalizedPath}" contains path traversal (..)`
			: 'No path traversal detected',
		passed: !traversalDetected,
		recoveryHint: traversalDetected
			? 'Use a relative path inside the project root without ".." segments.'
			: undefined,
		severity: traversalDetected ? 'error' : 'info',
	});

	// 2. Outside project check
	if (!isInsideProject) {
		checks.push({
			code: DOCUMENTATION_ROOT_DIAGNOSTIC_CODES.ROOT_OUTSIDE_PROJECT,
			message: `Documentation root "${normalizedPath}" is outside the project root`,
			passed: false,
			recoveryHint: 'Choose a path inside the project root.',
			severity: 'error',
		});
	} else {
		checks.push({
			code: DOCUMENTATION_ROOT_DIAGNOSTIC_CODES.ROOT_OUTSIDE_PROJECT,
			message: 'Documentation root is inside the project root',
			passed: true,
			severity: 'info',
		});
	}

	// 3. Unsafe absolute path check (only when outside project)
	if (isAbsoluteInput && !isInsideProject) {
		checks.push({
			code: DOCUMENTATION_ROOT_DIAGNOSTIC_CODES.ROOT_UNSAFE_ABSOLUTE,
			message: `Absolute path "${normalizedPath}" is outside the project root`,
			passed: false,
			recoveryHint: 'Use a relative path inside the project root.',
			severity: 'error',
		});
	} else {
		checks.push({
			code: DOCUMENTATION_ROOT_DIAGNOSTIC_CODES.ROOT_UNSAFE_ABSOLUTE,
			message: isAbsoluteInput
				? 'Absolute path is inside the project root (allowed)'
				: 'Path is relative (safe)',
			passed: true,
			severity: 'info',
		});
	}

	// 4. Reserved directory check
	if (isInsideProject) {
		const reserved = matchesReservedDir(normalizedPath, projectRoot);
		if (reserved.matches) {
			checks.push({
				code: DOCUMENTATION_ROOT_DIAGNOSTIC_CODES.ROOT_RESERVED_PATH,
				message: `Documentation root "${normalizedPath}" overlaps reserved path: ${reserved.dir}`,
				passed: false,
				recoveryHint: `Choose a path that does not overlap "${reserved.dir}".`,
				severity: 'error',
			});
		} else {
			checks.push({
				code: DOCUMENTATION_ROOT_DIAGNOSTIC_CODES.ROOT_RESERVED_PATH,
				message: 'No reserved path overlap detected',
				passed: true,
				severity: 'info',
			});
		}
	}

	// 5. Workspace state overlap (.logos)
	if (isInsideProject) {
		const logosOverlap = pathOverlaps(normalizedPath, '.logos');
		if (logosOverlap.isSame || logosOverlap.isChild || logosOverlap.isParent) {
			checks.push({
				code: DOCUMENTATION_ROOT_DIAGNOSTIC_CODES.ROOT_OVERLAPS_WORKSPACE_STATE,
				message: `Documentation root "${normalizedPath}" overlaps .logos workspace state directory`,
				passed: false,
				recoveryHint: 'Choose a path that does not overlap .logos.',
				severity: 'error',
			});
		} else {
			checks.push({
				code: DOCUMENTATION_ROOT_DIAGNOSTIC_CODES.ROOT_OVERLAPS_WORKSPACE_STATE,
				message: 'No workspace state overlap detected',
				passed: true,
				severity: 'info',
			});
		}
	}

	// 6. Source tree overlap
	if (isInsideProject && strictOverlapCheck) {
		let sourceOverlapDetected = false;
		let overlappedDir = '';
		for (const sourceDir of RESERVED_SOURCE_DIRS) {
			const overlap = pathOverlaps(normalizedPath, sourceDir);
			if (overlap.isSame || overlap.isChild || overlap.isParent) {
				sourceOverlapDetected = true;
				overlappedDir = sourceDir;
				break;
			}
		}
		if (sourceOverlapDetected) {
			checks.push({
				code: DOCUMENTATION_ROOT_DIAGNOSTIC_CODES.ROOT_OVERLAPS_SOURCE,
				message: `Documentation root overlaps source/test/script/profile directory: ${overlappedDir}`,
				passed: false,
				recoveryHint: `Choose a path that does not overlap "${overlappedDir}".`,
				severity: 'error',
			});
		} else {
			checks.push({
				code: DOCUMENTATION_ROOT_DIAGNOSTIC_CODES.ROOT_OVERLAPS_SOURCE,
				message: 'No source tree overlap detected',
				passed: true,
				severity: 'info',
			});
		}

		// Package metadata overlap
		let packageOverlapDetected = false;
		let overlappedFile = '';
		for (const pkgFile of RESERVED_PACKAGE_FILES) {
			const overlap = pathOverlaps(normalizedPath, pkgFile);
			if (overlap.isSame) {
				packageOverlapDetected = true;
				overlappedFile = pkgFile;
				break;
			}
		}
		if (packageOverlapDetected) {
			checks.push({
				code: DOCUMENTATION_ROOT_DIAGNOSTIC_CODES.ROOT_OVERLAPS_PACKAGE_METADATA,
				message: `Documentation root overlaps package metadata: ${overlappedFile}`,
				passed: false,
				recoveryHint: `Choose a path that does not overlap "${overlappedFile}".`,
				severity: 'error',
			});
		} else {
			checks.push({
				code: DOCUMENTATION_ROOT_DIAGNOSTIC_CODES.ROOT_OVERLAPS_PACKAGE_METADATA,
				message: 'No package metadata overlap detected',
				passed: true,
				severity: 'info',
			});
		}
	}

	// 7. Profile root overlap
	if (isInsideProject && activeProfileRoot) {
		const profileOverlap = pathOverlaps(normalizedPath, activeProfileRoot);
		if (profileOverlap.isSame || profileOverlap.isChild) {
			checks.push({
				code: DOCUMENTATION_ROOT_DIAGNOSTIC_CODES.ROOT_OVERLAPS_PROFILE,
				message: `Documentation root overlaps active profile root: ${activeProfileRoot}`,
				passed: false,
				recoveryHint:
					'Choose a path that does not overlap the active profile root.',
				severity: 'error',
			});
		} else {
			checks.push({
				code: DOCUMENTATION_ROOT_DIAGNOSTIC_CODES.ROOT_OVERLAPS_PROFILE,
				message: 'No profile root overlap detected',
				passed: true,
				severity: 'info',
			});
		}
	}

	// 8. Current root overlap
	if (currentDocumentationRoot && isInsideProject) {
		const currentOverlap = pathOverlaps(
			normalizedPath,
			currentDocumentationRoot,
		);
		if (currentOverlap.isSame) {
			checks.push({
				code: DOCUMENTATION_ROOT_DIAGNOSTIC_CODES.ROOT_CURRENT_OVERLAP,
				message: 'Proposed root is the same as the current root',
				passed: true, // Not a safety error, just informational
				recoveryHint: 'No change needed.',
				severity: 'info',
			});
		} else if (currentOverlap.isParent || currentOverlap.isChild) {
			checks.push({
				code: DOCUMENTATION_ROOT_DIAGNOSTIC_CODES.ROOT_CURRENT_OVERLAP,
				message:
					'Proposed root overlaps with current documentation root (parent/child relationship)',
				passed: true, // Not a hard error but worth flagging
				recoveryHint:
					'Overlapping roots may cause confusion with existing outputs.',
				severity: 'warning',
			});
		} else {
			checks.push({
				code: DOCUMENTATION_ROOT_DIAGNOSTIC_CODES.ROOT_CURRENT_OVERLAP,
				message: 'No overlap with current documentation root',
				passed: true,
				severity: 'info',
			});
		}
	}

	const safe = checks.every((c) => c.passed || c.severity !== 'error');

	return { checks, safe };
}

/**
 * Determine root health from inspection results.
 */
export function determineRootHealth(options: {
	safe: boolean;
	exists: boolean;
	isEmpty: boolean;
	containsNonLogosFiles: boolean;
	hasCollisions: boolean;
}): import('./documentation-root-model.js').DocumentationRootHealth {
	if (!options.safe) return 'unsafe';
	if (!options.exists) return 'missing';
	if (options.containsNonLogosFiles) return 'collision_risk';
	if (options.hasCollisions) return 'collision_risk';
	if (!options.isEmpty) return 'valid';
	return 'valid';
}

/**
 * Normalize a Windows-style path with backslashes to forward slashes.
 * Also handles double-slash normalization.
 */
export function normalizeWindowsSeparators(path: string): string {
	return normalizeSeparators(path);
}
