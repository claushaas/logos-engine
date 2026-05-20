/**
 * Documentation Root Affected Output Resolver — determines which outputs
 * would be impacted by a documentation root change.
 *
 * Phase 6: Documentation Root Configuration — Outcome 6 (affected-output reporting).
 *
 * This module computes the impact of a root change on existing canonical
 * and derived outputs. It does not move, delete, or regenerate any files.
 * It is purely a read-only resolver.
 *
 * All functions are pure/deterministic given structured inputs.
 */

import { relative, resolve } from 'node:path';
import type {
	CanonicalOutputImpact,
	DerivedOutputImpact,
	DocumentationRootAffectedOutputs,
	DocumentOutputImpactStatus,
} from './documentation-root-model.js';
import { normalizeSeparators } from './documentation-root-policy.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AffectedOutputResolverInput {
	/** Current documentation root (normalized relative) */
	currentRoot: string;
	/** Proposed documentation root (normalized relative) */
	proposedRoot: string;
	/** Project root (absolute, for path resolution) */
	absoluteProjectRoot: string;
	/** Array of registered artifacts */
	artifacts?: ArtifactSummary[] | undefined;
	/** Profile output declarations (canonical paths) */
	canonicalOutputDeclarations?: CanonicalOutputDeclaration[] | undefined;
}

export interface ArtifactSummary {
	artifactId: string;
	artifactType: string;
	path: string;
	isCanonical: boolean;
	status: string;
	sourceDocumentIds?: string[] | undefined;
}

export interface CanonicalOutputDeclaration {
	documentId: string;
	canonicalPath: string;
	phaseId?: string | undefined;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Compute the impact status for an output when changing the document root.
 */
function computeOutputImpact(
	currentAbsolutePath: string,
	currentRoot: string,
	proposedRoot: string,
	absoluteProjectRoot: string,
): {
	status: DocumentOutputImpactStatus;
	proposedPath: string;
	needsRegeneration: boolean;
	needsManualCleanup: boolean;
} {
	const normalizedCurrentRoot = normalizeSeparators(currentRoot);
	const normalizedProposedRoot = normalizeSeparators(proposedRoot);
	const normalizedAbsRoot = normalizeSeparators(resolve(absoluteProjectRoot));

	// Parse the current path relative to the current root
	const _normalizedAbsolute = normalizeSeparators(currentAbsolutePath);

	let relativeWithinRoot: string;
	try {
		relativeWithinRoot = relative(
			resolve(normalizedAbsRoot, normalizedCurrentRoot || '.'),
			currentAbsolutePath,
		);
		relativeWithinRoot = normalizeSeparators(relativeWithinRoot);
	} catch {
		// Can't compute relative path
		return {
			needsManualCleanup: true,
			needsRegeneration: true,
			proposedPath: resolve(normalizedAbsRoot, normalizedProposedRoot),
			status: 'unknown',
		};
	}

	// Skip if the path is not actually under the current root
	if (relativeWithinRoot.startsWith('..')) {
		return {
			needsManualCleanup: false,
			needsRegeneration: false,
			proposedPath: currentAbsolutePath,
			status: 'unchanged',
		};
	}

	// Compute proposed path
	const proposedPath = normalizeSeparators(
		resolve(
			normalizedAbsRoot,
			normalizedProposedRoot || '.',
			relativeWithinRoot,
		),
	);

	const status: DocumentOutputImpactStatus =
		normalizedProposedRoot === normalizedCurrentRoot
			? 'unchanged'
			: 'moved_path';

	return {
		needsManualCleanup: false,
		needsRegeneration: status === 'moved_path',
		proposedPath,
		status,
	};
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Resolve affected outputs for a proposed documentation root change.
 *
 * @returns Structured affected outputs report
 */
export function resolveAffectedOutputs(
	input: AffectedOutputResolverInput,
): DocumentationRootAffectedOutputs {
	const {
		currentRoot,
		proposedRoot,
		absoluteProjectRoot,
		artifacts = [],
		canonicalOutputDeclarations = [],
	} = input;

	const canonicalOutputs: CanonicalOutputImpact[] = [];
	const derivedOutputs: DerivedOutputImpact[] = [];

	// If same root, no changes needed
	if (normalizeSeparators(currentRoot) === normalizeSeparators(proposedRoot)) {
		return {
			canonicalOutputs: [],
			confidence: 1,
			derivedOutputs: [],
			impactFullyKnown: true,
			manualCleanupNeeded: 0,
			orphanedCount: 0,
			regenerationNeeded: 0,
			staleCount: 0,
		};
	}

	// Process registered artifacts
	for (const artifact of artifacts) {
		const impact = computeOutputImpact(
			artifact.path,
			currentRoot,
			proposedRoot,
			absoluteProjectRoot,
		);

		if (artifact.isCanonical) {
			canonicalOutputs.push({
				artifactId: artifact.artifactId,
				currentPath: artifact.path,
				needsManualCleanup: impact.needsManualCleanup,
				needsRegeneration: impact.needsRegeneration,
				proposedPath: impact.proposedPath,
				status: impact.status,
			});
		} else {
			derivedOutputs.push({
				artifactId: artifact.artifactId,
				artifactType: artifact.artifactType,
				currentPath: artifact.path,
				needsManualCleanup: impact.needsManualCleanup,
				needsRegeneration: impact.needsRegeneration,
				proposedPath: impact.proposedPath,
				status: impact.status,
			});
		}
	}

	// Process profile output declarations (for documents not yet generated)
	const registeredDocIds = new Set(canonicalOutputs.map((o) => o.artifactId));

	for (const decl of canonicalOutputDeclarations) {
		if (registeredDocIds.has(decl.documentId)) continue;

		const impact = computeOutputImpact(
			decl.canonicalPath,
			currentRoot,
			proposedRoot,
			absoluteProjectRoot,
		);

		if (impact.status !== 'unchanged') {
			canonicalOutputs.push({
				artifactId: decl.documentId,
				currentPath: decl.canonicalPath,
				needsManualCleanup: impact.needsManualCleanup,
				needsRegeneration: impact.needsRegeneration,
				proposedPath: impact.proposedPath,
				status: impact.status,
			});
		}
	}

	// Compute summary counts
	const regenerationNeeded =
		canonicalOutputs.filter((o) => o.needsRegeneration).length +
		derivedOutputs.filter((o) => o.needsRegeneration).length;

	const manualCleanupNeeded =
		canonicalOutputs.filter((o) => o.needsManualCleanup).length +
		derivedOutputs.filter((o) => o.needsManualCleanup).length;

	const orphanedCount =
		canonicalOutputs.filter((o) => o.status === 'orphaned').length +
		derivedOutputs.filter((o) => o.status === 'orphaned').length;

	const staleCount = regenerationNeeded + orphanedCount;

	return {
		canonicalOutputs,
		confidence: canonicalOutputs.length > 0 ? 1 : 0.8,
		derivedOutputs,
		impactFullyKnown: true,
		manualCleanupNeeded,
		orphanedCount,
		regenerationNeeded,
		staleCount,
	};
}
