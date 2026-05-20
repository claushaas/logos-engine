/**
 * Documentation Root Configuration Model — types for root reference, health,
 * collision, safety, affected outputs, preview, and apply results.
 *
 * Phase 6: Documentation Root Configuration — Outcome 1 (root configuration model).
 *
 * All types are pure, JSON-serializable, and free of side effects.
 * No raw secrets or unsafe absolute paths are stored in the stable display
 * fields.
 */

import type { LogosDiagnostic } from '../runtime/diagnostics.js';

// ---------------------------------------------------------------------------
// Root kind
// ---------------------------------------------------------------------------

export type DocumentationRootKind = 'default' | 'custom';

// ---------------------------------------------------------------------------
// Root health
// ---------------------------------------------------------------------------

export type DocumentationRootHealth =
	| 'valid'
	| 'missing'
	| 'unsafe'
	| 'collision_risk'
	| 'stale_outputs'
	| 'unknown';

// ---------------------------------------------------------------------------
// Collision kind
// ---------------------------------------------------------------------------

export type DocumentationRootCollisionKind =
	| 'non_empty_directory'
	| 'non_logos_files'
	| 'existing_logos_outputs'
	| 'derived_artifacts'
	| 'current_root_overlap'
	| 'parent_child_overlap'
	| 'workspace_state_overlap'
	| 'profile_root_overlap'
	| 'source_tree_overlap'
	| 'test_tree_overlap'
	| 'package_metadata_overlap'
	| 'symlink_escape'
	| 'scan_limit_reached'
	| 'unknown';

// ---------------------------------------------------------------------------
// Root reference
// ---------------------------------------------------------------------------

export interface DocumentationRootReference {
	/** Whether this is the default logos/ or a custom path */
	kind: DocumentationRootKind;
	/** The input path as provided by the user or workspace state */
	inputPath: string;
	/** Normalized relative path (portable, safe for snapshots) */
	normalizedRelativePath: string;
	/** Safe display path (relative, portable, no secrets) */
	safeDisplayPath: string;
	/** Whether this root was explicitly configured (not default) */
	wasExplicitlyConfigured: boolean;
	/** Whether the root is inside the project root boundary */
	insideProjectRoot: boolean;
	/** Whether the path exists on disk */
	exists: boolean;
	/** Whether the path is an empty directory (true even if missing) */
	isEmpty: boolean;
	/** Whether the path contains LOGOS-generated files */
	containsLogosFiles: boolean;
	/** Whether the path contains non-LOGOS files */
	containsNonLogosFiles: boolean;
}

// ---------------------------------------------------------------------------
// Safety result
// ---------------------------------------------------------------------------

export interface DocumentationRootSafetyResult {
	/** Whether the root passes all safety checks */
	safe: boolean;
	/** Diagnostics for each safety check */
	checks: DocumentationRootSafetyCheck[];
}

export interface DocumentationRootSafetyCheck {
	/** Stable code for this check */
	code: string;
	/** Whether the check passed */
	passed: boolean;
	/** Human-readable message */
	message: string;
	/** Severity */
	severity: 'error' | 'warning' | 'info';
	/** Optional recovery hint */
	recoveryHint?: string | undefined;
}

// ---------------------------------------------------------------------------
// Collision
// ---------------------------------------------------------------------------

export interface DocumentationRootCollision {
	/** Kind of collision detected */
	kind: DocumentationRootCollisionKind;
	/** Human-readable description */
	message: string;
	/** Optional safe path display */
	safePath?: string | undefined;
	/** Optional detail about what was found */
	detail?: string | undefined;
}

// ---------------------------------------------------------------------------
// Affected outputs
// ---------------------------------------------------------------------------

export type DocumentOutputImpactStatus =
	| 'unchanged'
	| 'moved_path'
	| 'stale'
	| 'orphaned'
	| 'missing'
	| 'unknown';

export interface CanonicalOutputImpact {
	/** Artifact id if registered */
	artifactId: string;
	/** Current path under current root */
	currentPath: string;
	/** Proposed path under new root */
	proposedPath: string;
	/** Status after root change */
	status: DocumentOutputImpactStatus;
	/** Whether this output needs regeneration */
	needsRegeneration: boolean;
	/** Whether this output needs manual cleanup */
	needsManualCleanup: boolean;
}

export interface DerivedOutputImpact {
	/** Artifact id if registered */
	artifactId: string;
	/** Current path under current root */
	currentPath: string;
	/** Proposed path under new root */
	proposedPath: string;
	/** Status after root change */
	status: DocumentOutputImpactStatus;
	/** Whether this output needs regeneration */
	needsRegeneration: boolean;
	/** Whether this output needs manual cleanup */
	needsManualCleanup: boolean;
	/** Artifact type for display */
	artifactType: string;
}

export interface DocumentationRootAffectedOutputs {
	/** Canonical (Markdown) outputs affected */
	canonicalOutputs: CanonicalOutputImpact[];
	/** Derived (HTML, agent packs, etc.) outputs affected */
	derivedOutputs: DerivedOutputImpact[];
	/** Number of outputs needing regeneration */
	regenerationNeeded: number;
	/** Number of outputs needing manual cleanup */
	manualCleanupNeeded: number;
	/** Number of orphaned outputs (no new home) */
	orphanedCount: number;
	/** Number of stale outputs */
	staleCount: number;
	/** Whether the impact is fully known */
	impactFullyKnown: boolean;
	/** Confidence in the impact assessment (0-1) */
	confidence: number;
}

// ---------------------------------------------------------------------------
// Root preview
// ---------------------------------------------------------------------------

export interface DocumentationRootPreview {
	/** Current documentation root */
	current: DocumentationRootReference;
	/** Proposed documentation root */
	proposed: DocumentationRootReference;
	/** Health assessment of the proposed root */
	health: DocumentationRootHealth;
	/** Safety check results */
	safety: DocumentationRootSafetyResult;
	/** Collision details */
	collisions: DocumentationRootCollision[];
	/** Affected outputs */
	affectedOutputs: DocumentationRootAffectedOutputs;
	/** Diagnostics for the proposed change */
	diagnostics: LogosDiagnostic[];
	/** Whether confirmation is required before applying */
	confirmationRequired: boolean;
	/** Whether this was a dry-run */
	dryRun: boolean;
}

// ---------------------------------------------------------------------------
// Root apply result
// ---------------------------------------------------------------------------

export interface DocumentationRootApplyResult {
	/** Whether the root was successfully changed */
	applied: boolean;
	/** The new active root (only present if applied) */
	newRoot?: DocumentationRootReference | undefined;
	/** Changed paths (only workspace state) */
	changedPaths: string[];
	/** Whether this was a dry-run */
	dryRun: boolean;
	/** Diagnostics from the apply operation */
	diagnostics: LogosDiagnostic[];
	/** Human-readable result messages */
	messages: string[];
}

// ---------------------------------------------------------------------------
// Root configuration status (for /status integration)
// ---------------------------------------------------------------------------

export interface DocumentationRootStatus {
	/** Current root reference */
	root: DocumentationRootReference;
	/** Root health */
	health: DocumentationRootHealth;
	/** Count of stale outputs (0 if unknown) */
	staleOutputCount: number;
	/** Count of orphaned outputs (0 if unknown) */
	orphanedOutputCount: number;
	/** Whether this is the default root */
	isDefault: boolean;
	/** Recovery hint for invalid/missing root */
	recoveryHint?: string | undefined;
}

// ---------------------------------------------------------------------------
// Diagnostic codes
// ---------------------------------------------------------------------------

export const DOCUMENTATION_ROOT_DIAGNOSTIC_CODES = {
	ROOT_AFFECTED_OUTPUTS_UNKNOWN: 'LOGOS_ROOT_AFFECTED_OUTPUTS_UNKNOWN',
	ROOT_CHANGE_APPLIED: 'LOGOS_ROOT_CHANGED',
	ROOT_CHANGE_CANCELLED: 'LOGOS_ROOT_CHANGE_CANCELLED',
	ROOT_CONFIRMATION_REQUIRED: 'LOGOS_ROOT_CONFIRMATION_REQUIRED',
	ROOT_CONTAINS_EXISTING_OUTPUTS: 'LOGOS_ROOT_CONTAINS_EXISTING_OUTPUTS',
	ROOT_CONTAINS_NON_LOGOS_FILES: 'LOGOS_ROOT_CONTAINS_NON_LOGOS_FILES',
	ROOT_CURRENT_MISSING: 'LOGOS_ROOT_CURRENT_MISSING',
	ROOT_CURRENT_OVERLAP: 'LOGOS_ROOT_CURRENT_OVERLAP',
	ROOT_NON_EMPTY: 'LOGOS_ROOT_NON_EMPTY',
	ROOT_OUTSIDE_PROJECT: 'LOGOS_ROOT_OUTSIDE_PROJECT',
	ROOT_OVERLAPS_PACKAGE_METADATA: 'LOGOS_ROOT_OVERLAPS_PACKAGE_METADATA',
	ROOT_OVERLAPS_PROFILE: 'LOGOS_ROOT_OVERLAPS_PROFILE',
	ROOT_OVERLAPS_SOURCE: 'LOGOS_ROOT_OVERLAPS_SOURCE',
	ROOT_OVERLAPS_TESTS: 'LOGOS_ROOT_OVERLAPS_TESTS',
	ROOT_OVERLAPS_WORKSPACE_STATE: 'LOGOS_ROOT_OVERLAPS_WORKSPACE_STATE',
	ROOT_PATH_TRAVERSAL: 'LOGOS_ROOT_PATH_TRAVERSAL',
	ROOT_PREVIEW_FAILED: 'LOGOS_ROOT_PREVIEW_FAILED',
	ROOT_PROPOSED_INVALID: 'LOGOS_ROOT_PROPOSED_INVALID',
	ROOT_RESERVED_PATH: 'LOGOS_ROOT_RESERVED_PATH',
	ROOT_SAME_AS_CURRENT: 'LOGOS_ROOT_SAME_AS_CURRENT',
	ROOT_SCAN_LIMIT_REACHED: 'LOGOS_ROOT_SCAN_LIMIT_REACHED',
	ROOT_STATE_UPDATE_FAILED: 'LOGOS_ROOT_STATE_UPDATE_FAILED',
	ROOT_SYMLINK_ESCAPE: 'LOGOS_ROOT_SYMLINK_ESCAPE',
	ROOT_UNSAFE_ABSOLUTE: 'LOGOS_ROOT_UNSAFE_ABSOLUTE',
	ROOT_WORKSPACE_NOT_INITIALIZED: 'LOGOS_ROOT_WORKSPACE_NOT_INITIALIZED',
} as const;
