/** Init Workspace Types — typed contracts for /init workspace creation */

import type { WorkspaceState } from '../state/workspace-state.schema.js';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface InitWorkspaceOptions {
	/** Explicit project root path; falls back to detection */
	projectRoot?: string | undefined;

	/** Documentation root path (relative to project root). Defaults to 'logos/'. */
	documentationRoot?: string | undefined;

	/** Profile id to lock. Defaults to 'standard'. */
	profileId?: string | undefined;

	/** Explicit profile root path (local custom profile). */
	profileRoot?: string | undefined;

	/** Whether to perform a dry run with no writes */
	dryRun?: boolean | undefined;

	/** Deterministic workspace ID for tests */
	_testWorkspaceId?: string | undefined;

	/** Deterministic timestamp for tests */
	_testTimestamp?: string | undefined;

	/** Injected filesystem adapter for tests */
	_fs?: import('../fs/safe-filesystem.js').SafeFsAdapter | undefined;

	/** Confirm execution after preflight (TUI gate) */
	confirm?: boolean | undefined;
}

// ---------------------------------------------------------------------------
// Target Paths
// ---------------------------------------------------------------------------

export interface InitWorkspaceTargetPaths {
	projectRoot: string;
	logosDir: string;
	workspaceStateFile: string;
	documentationRoot: string;
	documentationRootAbsolute: string;
}

// ---------------------------------------------------------------------------
// Profile Selection
// ---------------------------------------------------------------------------

export interface InitWorkspaceProfileSelection {
	profileId: string;
	source: 'bundled' | 'local' | 'custom' | 'remote';
	profileVersion?: string | undefined;
	registryPath?: string | undefined;
	safeProfileRoot?: string | undefined;
	validated: boolean;
	contractStatus?: string | undefined;
	executiveContractStatus?: string | undefined;
}

// ---------------------------------------------------------------------------
// Documentation Root Selection
// ---------------------------------------------------------------------------

export interface InitWorkspaceDocumentationRootSelection {
	rootPath: string;
	absolutePath: string;
	isDefault: boolean;
	wasExplicitlyConfigured: boolean;
	valid: boolean;
}

// ---------------------------------------------------------------------------
// Collision
// ---------------------------------------------------------------------------

export type InitWorkspaceCollisionKind =
	| 'none'
	| 'logos_dir_exists'
	| 'workspace_state_exists'
	| 'partial_logos_dir'
	| 'invalid_existing_state';

export interface InitWorkspaceCollision {
	kind: InitWorkspaceCollisionKind;
	message: string;
	path: string;
	recoveryHint?: string | undefined;
}

// ---------------------------------------------------------------------------
// Diagnostic
// ---------------------------------------------------------------------------

export interface InitWorkspaceDiagnostic {
	code: string;
	severity: 'info' | 'warning' | 'error';
	message: string;
	path?: string | undefined;
	recoveryHint?: string | undefined;
}

// ---------------------------------------------------------------------------
// Mode
// ---------------------------------------------------------------------------

export type InitWorkspaceMode = 'normal' | 'dry_run' | 'confirm_only';

// ---------------------------------------------------------------------------
// Preflight Result
// ---------------------------------------------------------------------------

export interface InitWorkspacePreflightResult {
	safe: boolean;
	mode: InitWorkspaceMode;
	diagnostics: InitWorkspaceDiagnostic[];
	collision: InitWorkspaceCollision;
	targetPaths: InitWorkspaceTargetPaths;
	profile: InitWorkspaceProfileSelection;
	documentationRoot: InitWorkspaceDocumentationRootSelection;
}

// ---------------------------------------------------------------------------
// Plan
// ---------------------------------------------------------------------------

export interface InitWorkspacePlan {
	/** The workspace state object to be persisted */
	state: WorkspaceState;

	/** Serialized JSON representation of the state */
	stateJson: string;

	/** Target paths */
	targetPaths: InitWorkspaceTargetPaths;

	/** Profile selection metadata */
	profile: InitWorkspaceProfileSelection;

	/** Documentation root selection metadata */
	documentationRoot: InitWorkspaceDocumentationRootSelection;

	/** Collision assessment */
	collision: InitWorkspaceCollision;

	/** Whether the plan is executable (no fatal errors) */
	executable: boolean;

	/** Preflight diagnostics */
	diagnostics: InitWorkspaceDiagnostic[];

	/** Whether preflight showed target paths */
	pathsDisclosed: boolean;
}

// ---------------------------------------------------------------------------
// Changed Path (init-specific)
// ---------------------------------------------------------------------------

export interface InitWorkspaceChangedPath {
	path: string;
	action: 'created' | 'modified' | 'deleted' | 'planned';
}

// ---------------------------------------------------------------------------
// Result
// ---------------------------------------------------------------------------

export interface InitWorkspaceResult {
	success: boolean;
	status: 'success' | 'warning' | 'error' | 'dry_run' | 'already_initialized';
	mode: InitWorkspaceMode;
	messages: string[];
	warnings: InitWorkspaceDiagnostic[];
	errors: InitWorkspaceDiagnostic[];
	changedPaths: InitWorkspaceChangedPath[];
	targetPaths: InitWorkspaceTargetPaths;
	profile: InitWorkspaceProfileSelection;
	documentationRoot: InitWorkspaceDocumentationRootSelection;
	createdTimestamp: string;
}
