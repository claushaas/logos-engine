/**
 * Documentation Root Preview Service — preview a proposed root change
 * without mutating any state or files.
 *
 * Phase 6: Documentation Root Configuration — Outcome 3 (root preview).
 *
 * This module generates a full DocumentationRootPreview showing current
 * root, proposed root, safety status, collisions, affected outputs, and
 * diagnostics. It is read-only and never writes files.
 */

import { readdir, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import type {
	LogosDiagnostic,
	LogosRecoveryHint,
} from '../runtime/diagnostics.js';
import type {
	ArtifactSummary,
	CanonicalOutputDeclaration,
} from './documentation-root-affected-outputs.js';
import { resolveAffectedOutputs } from './documentation-root-affected-outputs.js';
import { scanForCollisions } from './documentation-root-collision.js';
import type {
	DocumentationRootCollision,
	DocumentationRootHealth,
	DocumentationRootPreview,
	DocumentationRootReference,
} from './documentation-root-model.js';
import { DOCUMENTATION_ROOT_DIAGNOSTIC_CODES } from './documentation-root-model.js';
import {
	DEFAULT_DOCUMENTATION_ROOT,
	determineRootHealth,
	normalizeDocumentationRootPath,
	normalizeSeparators,
	validateDocumentationRootPath,
} from './documentation-root-policy.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PreviewDocumentationRootOptions {
	/** Project root (absolute) */
	projectRoot: string;
	/** Current documentation root configuration */
	currentRootConfig: {
		rootPath: string;
		isDefault: boolean;
		wasExplicitlyConfigured?: boolean | undefined;
	};
	/** Proposed new root path (relative or absolute) */
	proposedPath: string;
	/** Active profile root path (relative to projectRoot, if custom) */
	activeProfileRoot?: string | undefined;
	/** Registered artifacts from workspace state */
	artifacts?: ArtifactSummary[] | undefined;
	/** Profile output declarations */
	canonicalOutputDeclarations?: CanonicalOutputDeclaration[] | undefined;
	/** Dry-run mode (no writes, even for status checks) */
	dryRun?: boolean | undefined;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a LogosRecoveryHint from a simple message */
function makeRecoveryHint(message: string): LogosRecoveryHint[] {
	if (!message) return [];
	return [{ category: 'manual_review', message }];
}

/** Build a LogosDiagnostic with recovery hints */
function makeDiagnostic(
	code: string,
	message: string,
	severity: 'error' | 'warning' | 'info',
	recoveryHint?: string,
): LogosDiagnostic {
	return {
		code,
		message,
		recoveryHints: recoveryHint ? makeRecoveryHint(recoveryHint) : [],
		severity,
	};
}

/**
 * Check if a path looks like an absolute path input.
 */
function isAbsolutePathInput(path: string): boolean {
	return path.startsWith('/') || /^[A-Z]:\\/i.test(path);
}

async function buildRootReference(
	inputPath: string,
	projectRoot: string,
	isDefault: boolean,
	wasExplicitlyConfigured: boolean,
): Promise<DocumentationRootReference> {
	const { normalized, isInsideProject } = normalizeDocumentationRootPath(
		inputPath,
		projectRoot,
	);

	const normalizedRelative = isDefault
		? normalizeSeparators(DEFAULT_DOCUMENTATION_ROOT)
		: normalized;

	// Determine existence and emptiness
	let exists = false;
	let isEmpty = true;
	try {
		const resolved = resolve(projectRoot, normalizedRelative);
		const s = await stat(resolved);
		exists = true;
		if (s.isDirectory()) {
			try {
				const entries = await readdir(resolved);
				const nonHidden = entries.filter(
					(e) => !e.startsWith('.') || e === '.logos',
				);
				isEmpty = nonHidden.length === 0;
			} catch {
				isEmpty = false;
			}
		} else {
			isEmpty = false;
		}
	} catch {
		exists = false;
		isEmpty = true;
	}

	return {
		containsLogosFiles: false,
		containsNonLogosFiles: false,
		exists,
		inputPath,
		insideProjectRoot: isInsideProject,
		isEmpty,
		kind: isDefault ? 'default' : 'custom',
		normalizedRelativePath: normalizedRelative,
		safeDisplayPath: normalizedRelative,
		wasExplicitlyConfigured,
	};
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Preview a proposed documentation root change.
 *
 * This function:
 * 1. Builds current and proposed root references
 * 2. Validates the proposed path for safety
 * 3. Scans for collisions
 * 4. Resolves affected outputs
 * 5. Builds diagnostics
 *
 * @returns A complete DocumentationRootPreview
 */
export async function previewDocumentationRootChange(
	options: PreviewDocumentationRootOptions,
): Promise<DocumentationRootPreview> {
	const {
		projectRoot,
		currentRootConfig,
		proposedPath,
		activeProfileRoot,
		artifacts,
		canonicalOutputDeclarations,
		dryRun = true,
	} = options;

	const diagnostics: LogosDiagnostic[] = [];
	const collisions: DocumentationRootCollision[] = [];

	// Build current root reference
	const current = await buildRootReference(
		currentRootConfig.rootPath,
		projectRoot,
		currentRootConfig.isDefault,
		currentRootConfig.wasExplicitlyConfigured ?? false,
	);

	// Build proposed root reference
	const proposed = await buildRootReference(
		proposedPath,
		projectRoot,
		false,
		true,
	);

	// If same root, early return
	if (
		normalizeSeparators(current.normalizedRelativePath) ===
		normalizeSeparators(proposed.normalizedRelativePath)
	) {
		diagnostics.push(
			makeDiagnostic(
				DOCUMENTATION_ROOT_DIAGNOSTIC_CODES.ROOT_SAME_AS_CURRENT,
				`Proposed root "${proposedPath}" is the same as the current root`,
				'info',
				'No change needed.',
			),
		);
	}

	// Validate proposed path safety
	const { isInsideProject } = normalizeDocumentationRootPath(
		proposedPath,
		projectRoot,
	);

	const safety = validateDocumentationRootPath({
		activeProfileRoot,
		currentDocumentationRoot: currentRootConfig.rootPath,
		isAbsoluteInput: isAbsolutePathInput(proposedPath),
		isInsideProject,
		normalizedPath: proposed.normalizedRelativePath,
		projectRoot,
	});

	// Add safety diagnostics
	for (const check of safety.checks) {
		if (!check.passed && check.severity === 'error') {
			diagnostics.push(
				makeDiagnostic(check.code, check.message, 'error', check.recoveryHint),
			);
		} else if (!check.passed && check.severity === 'warning') {
			diagnostics.push(
				makeDiagnostic(
					check.code,
					check.message,
					'warning',
					check.recoveryHint,
				),
			);
		}
	}

	// If not safe, skip collision scanning
	let collisionResult:
		| Awaited<ReturnType<typeof scanForCollisions>>
		| undefined;

	if (safety.safe && isInsideProject) {
		const absoluteTargetPath = resolve(
			projectRoot,
			proposed.normalizedRelativePath,
		);

		collisionResult = await scanForCollisions({
			absoluteProjectRoot: resolve(projectRoot),
			absoluteTargetPath,
			activeProfileRoot,
			currentDocumentationRoot: currentRootConfig.rootPath,
		});

		collisions.push(...collisionResult.collisions);

		// Update proposed reference with collision scan data
		proposed.containsLogosFiles = collisionResult.containsLogosFiles;
		proposed.containsNonLogosFiles = collisionResult.containsNonLogosFiles;
		proposed.isEmpty = collisionResult.directoryEmpty;
		proposed.exists = collisionResult.directoryExists;

		// Add collision diagnostics
		for (const collision of collisionResult.collisions) {
			const severity: 'error' | 'warning' | 'info' =
				collision.kind === 'symlink_escape' ||
				collision.kind === 'workspace_state_overlap' ||
				collision.kind === 'profile_root_overlap' ||
				collision.kind === 'source_tree_overlap' ||
				collision.kind === 'test_tree_overlap' ||
				collision.kind === 'package_metadata_overlap'
					? 'error'
					: 'warning';

			diagnostics.push(
				makeDiagnostic(
					mapCollisionKindToCode(collision.kind),
					collision.message,
					severity,
					collision.detail,
				),
			);
		}
	}

	// Resolve affected outputs
	const affectedOutputs = resolveAffectedOutputs({
		absoluteProjectRoot: resolve(projectRoot),
		artifacts,
		canonicalOutputDeclarations,
		currentRoot: currentRootConfig.rootPath,
		proposedRoot: proposed.normalizedRelativePath,
	});

	if (affectedOutputs.staleCount > 0) {
		diagnostics.push(
			makeDiagnostic(
				DOCUMENTATION_ROOT_DIAGNOSTIC_CODES.ROOT_AFFECTED_OUTPUTS_UNKNOWN,
				`${affectedOutputs.staleCount} outputs will be affected by the root change`,
				'warning',
				'These outputs will be marked as stale. Run /generate after applying the root change to regenerate.',
			),
		);
	}

	// Determine health
	const health: DocumentationRootHealth = safety.safe
		? determineRootHealth({
				containsNonLogosFiles: collisionResult?.containsNonLogosFiles ?? false,
				exists: proposed.exists,
				hasCollisions: collisions.length > 0,
				isEmpty: proposed.isEmpty,
				safe: true,
			})
		: 'unsafe';

	return {
		affectedOutputs,
		collisions,
		confirmationRequired: true,
		current,
		diagnostics,
		dryRun,
		health,
		proposed,
		safety,
	};
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapCollisionKindToCode(
	kind: DocumentationRootCollision['kind'],
): string {
	switch (kind) {
		case 'non_empty_directory':
			return DOCUMENTATION_ROOT_DIAGNOSTIC_CODES.ROOT_NON_EMPTY;
		case 'non_logos_files':
			return DOCUMENTATION_ROOT_DIAGNOSTIC_CODES.ROOT_CONTAINS_NON_LOGOS_FILES;
		case 'existing_logos_outputs':
			return DOCUMENTATION_ROOT_DIAGNOSTIC_CODES.ROOT_CONTAINS_EXISTING_OUTPUTS;
		case 'derived_artifacts':
			return DOCUMENTATION_ROOT_DIAGNOSTIC_CODES.ROOT_CONTAINS_EXISTING_OUTPUTS;
		case 'current_root_overlap':
		case 'parent_child_overlap':
			return DOCUMENTATION_ROOT_DIAGNOSTIC_CODES.ROOT_CURRENT_OVERLAP;
		case 'workspace_state_overlap':
			return DOCUMENTATION_ROOT_DIAGNOSTIC_CODES.ROOT_OVERLAPS_WORKSPACE_STATE;
		case 'profile_root_overlap':
			return DOCUMENTATION_ROOT_DIAGNOSTIC_CODES.ROOT_OVERLAPS_PROFILE;
		case 'source_tree_overlap':
			return DOCUMENTATION_ROOT_DIAGNOSTIC_CODES.ROOT_OVERLAPS_SOURCE;
		case 'test_tree_overlap':
			return DOCUMENTATION_ROOT_DIAGNOSTIC_CODES.ROOT_OVERLAPS_TESTS;
		case 'package_metadata_overlap':
			return DOCUMENTATION_ROOT_DIAGNOSTIC_CODES.ROOT_OVERLAPS_PACKAGE_METADATA;
		case 'symlink_escape':
			return DOCUMENTATION_ROOT_DIAGNOSTIC_CODES.ROOT_SYMLINK_ESCAPE;
		case 'scan_limit_reached':
			return DOCUMENTATION_ROOT_DIAGNOSTIC_CODES.ROOT_SCAN_LIMIT_REACHED;
		default:
			return DOCUMENTATION_ROOT_DIAGNOSTIC_CODES.ROOT_PROPOSED_INVALID;
	}
}
