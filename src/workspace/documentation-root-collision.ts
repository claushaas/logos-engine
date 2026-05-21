/**
 * Documentation Root Collision Scanner — bounded collision detection for
 * proposed documentation root paths.
 *
 * Phase 6: Documentation Root Configuration — Outcome 5 (collision checks).
 *
 * This module scans the target directory for existing content to detect
 * potential collisions. It enforces bounded scanning (max entries, max depth)
 * and never reads .env files, source code contents, or sensitive files.
 *
 * All functions return structured results and never mutate files.
 */

import { readdir, realpath, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { DocumentationRootCollision } from './documentation-root-model.js';
import {
	COLLISION_SCAN_MAX_DEPTH,
	COLLISION_SCAN_MAX_ENTRIES,
	normalizeSeparators,
	pathOverlaps,
} from './documentation-root-policy.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CollisionScanOptions {
	/** Absolute path to the target directory */
	absoluteTargetPath: string;
	/** Absolute project root path */
	absoluteProjectRoot: string;
	/** Current documentation root (normalized relative) */
	currentDocumentationRoot: string;
	/** Active profile root (relative, if custom) */
	activeProfileRoot?: string | undefined;
	/** Max entries to scan (default: COLLISION_SCAN_MAX_ENTRIES) */
	maxEntries?: number | undefined;
	/** Max depth to scan (default: COLLISION_SCAN_MAX_DEPTH) */
	maxDepth?: number | undefined;
}

export interface CollisionScanResult {
	/** Detected collisions */
	collisions: DocumentationRootCollision[];
	/** Whether the scan limit was reached */
	scanLimitReached: boolean;
	/** Total entries scanned */
	entriesScanned: number;
	/** Whether the directory exists */
	directoryExists: boolean;
	/** Whether the directory is empty */
	directoryEmpty: boolean;
	/** Whether LOGOS-generated files were found */
	containsLogosFiles: boolean;
	/** Whether non-LOGOS files were found */
	containsNonLogosFiles: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Files that indicate LOGOS-generated content */
const LOGOS_MARKER_PATTERNS = [
	/^LOGOS_.*\.md$/,
	/^logos-.*\.(md|html|json)$/,
	/\.logos\.json$/,
];

/** Hidden files/dirs to skip during scanning */
const SKIP_SCAN_PATTERNS = [/^\.env$/, /^\.env\./, /^\.git$/, /^\.logos$/];

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function isLogosGeneratedFile(name: string): boolean {
	return LOGOS_MARKER_PATTERNS.some((p) => p.test(name));
}

function isSkippedEntry(name: string): boolean {
	return SKIP_SCAN_PATTERNS.some((p) => p.test(name));
}

/**
 * Check for symlink escape.
 * Resolves the real path and verifies it's inside the project root.
 */
async function checkSymlinkEscape(
	absolutePath: string,
	absoluteProjectRoot: string,
): Promise<DocumentationRootCollision | null> {
	try {
		const resolved = await realpath(absolutePath);
		// Also resolve the project root to handle symlinks like /tmp -> /private/tmp on macOS
		let realProjectRoot: string;
		try {
			realProjectRoot = await realpath(absoluteProjectRoot);
		} catch {
			realProjectRoot = resolve(absoluteProjectRoot);
		}
		const normalizedResolved = normalizeSeparators(resolved);
		const normalizedProject = normalizeSeparators(realProjectRoot);

		if (
			normalizedResolved !== normalizedProject &&
			!normalizedResolved.startsWith(`${normalizedProject}/`)
		) {
			return {
				detail: `Resolves to: ${resolved}`,
				kind: 'symlink_escape',
				message: `Documentation root path resolves outside the project root via symlink`,
				safePath: resolved,
			};
		}
		return null;
	} catch {
		// symlink resolution failed — likely doesn't exist or can't resolve
		return null;
	}
}

/**
 * Scan a directory entry (bounded).
 */
async function scanDirectoryEntry(
	entryName: string,
): Promise<{ isLogosFile: boolean; isSkipped: boolean }> {
	return {
		isLogosFile: isLogosGeneratedFile(entryName),
		isSkipped: isSkippedEntry(entryName),
	};
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Scan a proposed documentation root for collisions.
 *
 * This function performs bounded scanning:
 * - Max entries: COLLISION_SCAN_MAX_ENTRIES (100)
 * - Max depth: COLLISION_SCAN_MAX_DEPTH (3)
 * - Skips .env, .git, .logos entries
 * - Never reads file contents (only directory listing and stats)
 * - Reports collision with non-LOGOS files, existing LOGOS outputs, etc.
 */
export async function scanForCollisions(
	options: CollisionScanOptions,
): Promise<CollisionScanResult> {
	const {
		absoluteTargetPath,
		absoluteProjectRoot,
		currentDocumentationRoot,
		activeProfileRoot,
		maxEntries = COLLISION_SCAN_MAX_ENTRIES,
		maxDepth = COLLISION_SCAN_MAX_DEPTH,
	} = options;

	const result: CollisionScanResult = {
		collisions: [],
		containsLogosFiles: false,
		containsNonLogosFiles: false,
		directoryEmpty: true,
		directoryExists: false,
		entriesScanned: 0,
		scanLimitReached: false,
	};

	// Check if directory exists
	let dirStat: Awaited<ReturnType<typeof stat>> | undefined;
	try {
		dirStat = await stat(absoluteTargetPath);
	} catch {
		// Directory doesn't exist — no collisions possible
		result.directoryExists = false;
		result.directoryEmpty = true;
		return result;
	}

	if (!dirStat.isDirectory()) {
		result.collisions.push({
			kind: 'non_empty_directory',
			message: `Target path "${absoluteTargetPath}" exists but is not a directory`,
			safePath: absoluteTargetPath,
		});
		result.directoryExists = true;
		result.directoryEmpty = false;
		return result;
	}

	result.directoryExists = true;

	// Check symlink escape
	const symlinkCollision = await checkSymlinkEscape(
		absoluteTargetPath,
		absoluteProjectRoot,
	);
	if (symlinkCollision) {
		result.collisions.push(symlinkCollision);
	}

	// Check overlap with .logos
	const normalizedRel = normalizeSeparators(
		absoluteTargetPath.slice(
			normalizeSeparators(resolve(absoluteProjectRoot)).length + 1,
		),
	);
	const logosOverlap = pathOverlaps(normalizedRel, '.logos');
	if (logosOverlap.isSame || logosOverlap.isChild || logosOverlap.isParent) {
		result.collisions.push({
			kind: 'workspace_state_overlap',
			message: 'Documentation root overlaps .logos workspace state directory',
			safePath: '.logos',
		});
	}

	// Check overlap with current documentation root
	if (currentDocumentationRoot) {
		const currentOverlap = pathOverlaps(
			normalizedRel,
			currentDocumentationRoot,
		);
		if (
			currentOverlap.isSame ||
			currentOverlap.isParent ||
			currentOverlap.isChild
		) {
			result.collisions.push({
				kind: 'current_root_overlap',
				message: `Documentation root overlaps current root: ${currentDocumentationRoot}`,
				safePath: currentDocumentationRoot,
			});
		}
	}

	// Check profile root overlap
	if (activeProfileRoot) {
		const profileOverlap = pathOverlaps(normalizedRel, activeProfileRoot);
		if (profileOverlap.isSame || profileOverlap.isChild) {
			result.collisions.push({
				kind: 'profile_root_overlap',
				message: `Documentation root overlaps active profile root: ${activeProfileRoot}`,
				safePath: activeProfileRoot,
			});
		}
	}

	// Bounded scan of directory contents
	let entries: string[] = [];
	try {
		entries = await readdir(absoluteTargetPath);
	} catch {
		// Can't read directory
		result.collisions.push({
			detail: 'Could not read directory contents',
			kind: 'unknown',
			message: 'Could not inspect the target directory',
			safePath: absoluteTargetPath,
		});
		return result;
	}

	if (entries.length === 0) {
		result.directoryEmpty = true;
		return result;
	}

	result.directoryEmpty = false;

	// Scan entries (first level only, bounded)
	const entriesToScan = entries.slice(0, maxEntries);
	result.entriesScanned = entriesToScan.length;

	if (entries.length > maxEntries) {
		result.scanLimitReached = true;
	}

	// Process entries — check for .env, LOGOS markers, non-LOGOS files
	let hasNonEnvEntries = false;

	for (const entry of entriesToScan) {
		const scanResult = await scanDirectoryEntry(entry);

		if (scanResult.isSkipped) {
			continue;
		}

		hasNonEnvEntries = true;

		if (scanResult.isLogosFile) {
			result.containsLogosFiles = true;
		} else {
			result.containsNonLogosFiles = true;
		}

		result.entriesScanned++;
	}

	// Report collisions based on findings
	if (result.containsLogosFiles) {
		result.collisions.push({
			kind: 'existing_logos_outputs',
			message: 'Target directory contains existing LOGOS-generated files',
			safePath: absoluteTargetPath,
		});
	}

	if (result.containsNonLogosFiles) {
		result.collisions.push({
			kind: 'non_logos_files',
			message: 'Target directory contains non-LOGOS files',
			safePath: absoluteTargetPath,
		});
	}

	if (
		!hasNonEnvEntries &&
		!result.containsLogosFiles &&
		!result.containsNonLogosFiles
	) {
		// Only .env or skipped files — directory is effectively empty for our purposes
		result.directoryEmpty = true;
	}

	// If directory has entries and no collision type was assigned, mark as non-empty
	if (!result.directoryEmpty && result.collisions.length === 0) {
		result.collisions.push({
			kind: 'non_empty_directory',
			message: 'Target directory exists and contains files',
			safePath: absoluteTargetPath,
		});
	}

	if (result.scanLimitReached) {
		result.collisions.push({
			detail: `${entriesToScan.length} of ${entries.length} entries scanned`,
			kind: 'scan_limit_reached',
			message: `Scan limit reached (${maxEntries} entries). Not all files were inspected.`,
		});
	}

	return result;
}
