/**
 * Documentation Root Service — high-level orchestration for root
 * configuration operations.
 *
 * Phase 6: Documentation Root Configuration — Main service.
 *
 * This module provides the public API for documentation root management:
 * - getStatus: current root health and metadata
 * - preview: read-only preview of a proposed change
 * - apply: confirmed root change
 * - reset: reset to default logos/
 *
 * All operations respect safe filesystem boundaries and never
 * call AI providers, network, or external services.
 */

import { resolve } from 'node:path';
import { readWorkspaceState } from '../state/workspace-state-repository.js';
import type {
	ArtifactSummary,
	CanonicalOutputDeclaration,
} from './documentation-root-affected-outputs.js';
import { applyDocumentationRootChange } from './documentation-root-apply.js';
import type {
	DocumentationRootApplyResult,
	DocumentationRootPreview,
	DocumentationRootStatus,
} from './documentation-root-model.js';
import {
	DEFAULT_DOCUMENTATION_ROOT,
	determineRootHealth,
	normalizeDocumentationRootPath,
	normalizeSeparators,
} from './documentation-root-policy.js';
import { previewDocumentationRootChange } from './documentation-root-preview.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DocumentationRootServiceOptions {
	/** Project root (absolute) */
	projectRoot: string;
	/** Active profile root path (if custom) */
	activeProfileRoot?: string | undefined;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get the current documentation root status.
 */
export async function getDocumentationRootStatus(
	options: DocumentationRootServiceOptions,
): Promise<DocumentationRootStatus> {
	const { projectRoot } = options;

	let rootPath = DEFAULT_DOCUMENTATION_ROOT;
	let isDefault = true;
	let wasExplicitlyConfigured = false;
	let staleOutputCount = 0;
	const orphanedOutputCount = 0;

	// Try to read workspace state
	try {
		const readResult = await readWorkspaceState({ projectRoot });
		if (readResult.success && readResult.state) {
			rootPath = readResult.state.documentation.rootPath;
			isDefault = readResult.state.documentation.isDefault;
			wasExplicitlyConfigured =
				readResult.state.documentation.wasExplicitlyConfigured ?? false;

			// Count stale/missing artifacts
			if (readResult.state.artifacts) {
				for (const artifact of readResult.state.artifacts) {
					if (artifact.status === 'stale' || artifact.status === 'missing') {
						staleOutputCount++;
					}
				}
			}
		}
	} catch {
		// Fall back to defaults
	}

	const { normalized, isInsideProject } = normalizeDocumentationRootPath(
		rootPath,
		projectRoot,
	);

	// Build reference
	const { stat } = await import('node:fs/promises');
	let exists = false;
	let isEmpty = true;
	let containsNonLogosFiles = false;

	try {
		const resolved = resolve(projectRoot, rootPath);
		const s = await stat(resolved);
		exists = true;
		if (s.isDirectory()) {
			const { readdir } = await import('node:fs/promises');
			const entries = await readdir(resolved);
			const nonHidden = entries.filter((e) => !e.startsWith('.'));
			isEmpty = nonHidden.length === 0;
			containsNonLogosFiles = nonHidden.length > 0;
		}
	} catch {
		exists = false;
	}

	const health = determineRootHealth({
		containsNonLogosFiles,
		exists,
		hasCollisions: false,
		isEmpty,
		safe: isInsideProject,
	});

	const recoveryHint =
		health === 'missing'
			? `Documentation root "${rootPath}" does not exist. Run /generate to create canonical documents, or /root set to change the root.`
			: health === 'unsafe'
				? `Documentation root "${rootPath}" is unsafe. Run /root set to choose a safe path.`
				: undefined;

	return {
		health,
		isDefault,
		orphanedOutputCount,
		recoveryHint,
		root: {
			containsLogosFiles: false,
			containsNonLogosFiles,
			exists,
			inputPath: rootPath,
			insideProjectRoot: isInsideProject,
			isEmpty,
			kind: isDefault ? 'default' : 'custom',
			normalizedRelativePath: normalizeSeparators(rootPath),
			safeDisplayPath: normalizeSeparators(rootPath),
			wasExplicitlyConfigured,
		},
		staleOutputCount,
	};
}

/**
 * Preview a proposed documentation root change.
 *
 * Read-only. Never writes files.
 */
export async function previewRootChange(
	options: DocumentationRootServiceOptions & {
		proposedPath: string;
		artifacts?: ArtifactSummary[] | undefined;
		canonicalOutputDeclarations?: CanonicalOutputDeclaration[] | undefined;
	},
): Promise<DocumentationRootPreview> {
	const {
		projectRoot,
		activeProfileRoot,
		proposedPath,
		artifacts,
		canonicalOutputDeclarations,
	} = options;

	// Get current root config
	let currentRootConfig = {
		isDefault: true,
		rootPath: DEFAULT_DOCUMENTATION_ROOT,
		wasExplicitlyConfigured: false,
	};

	try {
		const readResult = await readWorkspaceState({ projectRoot });
		if (readResult.success && readResult.state) {
			currentRootConfig = {
				isDefault: readResult.state.documentation.isDefault,
				rootPath: readResult.state.documentation.rootPath,
				wasExplicitlyConfigured:
					readResult.state.documentation.wasExplicitlyConfigured ?? false,
			};
		}
	} catch {
		// Use defaults
	}

	return previewDocumentationRootChange({
		activeProfileRoot,
		artifacts,
		canonicalOutputDeclarations,
		currentRootConfig,
		projectRoot,
		proposedPath,
	});
}

/**
 * Apply a confirmed documentation root change.
 *
 * Re-runs preflight, writes state, marks outputs stale.
 * Never moves or deletes files.
 */
export async function applyRootChange(
	options: DocumentationRootServiceOptions & {
		proposedPath: string;
		dryRun?: boolean | undefined;
		confirmed?: boolean | undefined;
		artifacts?: ArtifactSummary[] | undefined;
		canonicalOutputDeclarations?: CanonicalOutputDeclaration[] | undefined;
	},
): Promise<DocumentationRootApplyResult> {
	const {
		projectRoot,
		activeProfileRoot,
		proposedPath,
		dryRun,
		confirmed,
		artifacts,
		canonicalOutputDeclarations,
	} = options;

	return applyDocumentationRootChange({
		activeProfileRoot,
		artifacts,
		canonicalOutputDeclarations,
		confirmed,
		dryRun,
		projectRoot,
		proposedPath,
	});
}

/**
 * Preview a reset to the default documentation root (logos/).
 */
export async function previewResetToDefault(
	options: DocumentationRootServiceOptions & {
		artifacts?: ArtifactSummary[] | undefined;
		canonicalOutputDeclarations?: CanonicalOutputDeclaration[] | undefined;
	},
): Promise<DocumentationRootPreview> {
	return previewRootChange({
		...options,
		proposedPath: DEFAULT_DOCUMENTATION_ROOT,
	});
}

/**
 * Apply a reset to the default documentation root (logos/).
 */
export async function applyResetToDefault(
	options: DocumentationRootServiceOptions & {
		dryRun?: boolean | undefined;
		confirmed?: boolean | undefined;
		artifacts?: ArtifactSummary[] | undefined;
		canonicalOutputDeclarations?: CanonicalOutputDeclaration[] | undefined;
	},
): Promise<DocumentationRootApplyResult> {
	return applyRootChange({
		...options,
		proposedPath: DEFAULT_DOCUMENTATION_ROOT,
	});
}
