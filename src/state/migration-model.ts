/**
 * Migration Model — versioned, deterministic migration contracts for .logos/ workspace state.
 *
 * Step 13.2 — Implement Migrations, Backups, and Performance Baseline
 *
 * This module defines the type system for workspace schema migrations:
 * - Schema version detection and comparison
 * - Migration plan, item, direction, status
 * - Backup manifest, options, integrity
 * - Restore plan and options
 */

// ---------------------------------------------------------------------------
// Schema Version
// ---------------------------------------------------------------------------

/** Workspace schema version string (semver-like) */
export type WorkspaceSchemaVersion = string;

/** Known version detection result */
export type SchemaVersionDetection =
	| 'current'
	| 'older'
	| 'future'
	| 'missing'
	| 'corrupt';

// ---------------------------------------------------------------------------
// Migration Direction
// ---------------------------------------------------------------------------

export type WorkspaceMigrationDirection = 'up' | 'down' | 'verify_only';

export const MIGRATION_DIRECTION_ORDER: Record<
	WorkspaceMigrationDirection,
	number
> = {
	down: 2,
	up: 0,
	verify_only: 1,
};

// ---------------------------------------------------------------------------
// Migration Status
// ---------------------------------------------------------------------------

export type WorkspaceMigrationStatus =
	| 'not_needed'
	| 'planned'
	| 'applied'
	| 'blocked'
	| 'failed'
	| 'partial'
	| 'dry_run'
	| 'unknown';

export const MIGRATION_STATUS_ORDER: Record<WorkspaceMigrationStatus, number> =
	{
		applied: 2,
		blocked: 1,
		dry_run: 5,
		failed: 0,
		not_needed: 6,
		partial: 3,
		planned: 4,
		unknown: 7,
	};

// ---------------------------------------------------------------------------
// Backup Status
// ---------------------------------------------------------------------------

export type WorkspaceBackupStatus =
	| 'created'
	| 'verified'
	| 'restored'
	| 'skipped'
	| 'blocked'
	| 'failed'
	| 'partial'
	| 'dry_run';

export const BACKUP_STATUS_ORDER: Record<WorkspaceBackupStatus, number> = {
	blocked: 1,
	created: 2,
	dry_run: 5,
	failed: 0,
	partial: 3,
	restored: 4,
	skipped: 6,
	verified: 7,
};

// ---------------------------------------------------------------------------
// Migration Identity
// ---------------------------------------------------------------------------

export type WorkspaceMigrationId = string;

// ---------------------------------------------------------------------------
// Migration Input / Options
// ---------------------------------------------------------------------------

export interface WorkspaceMigrationInput {
	/** Path to the project root */
	projectRoot: string;
	/** Current workspace state file path */
	workspaceFilePath: string;
	/** Detected current schema version */
	detectedVersion: WorkspaceSchemaVersion;
	/** Version detection result */
	detectionResult: SchemaVersionDetection;
	/** Optional injected filesystem adapter for tests */
	_fs?: import('../fs/safe-filesystem.js').SafeFsAdapter | undefined;
}

export interface WorkspaceMigrationOptions {
	/** Dry-run mode: plan but write nothing */
	dryRun?: boolean | undefined;
	/** Direction (default: up) */
	direction?: WorkspaceMigrationDirection | undefined;
	/** Skip backup creation (only for tests that manage their own backups) */
	skipBackup?: boolean | undefined;
	/** Deterministic timestamp for tests */
	_testTimestamp?: string | undefined;
	/** Deterministic random ID for tests */
	_testRandomId?: string | undefined;
}

// ---------------------------------------------------------------------------
// Migration Plan Item
// ---------------------------------------------------------------------------

export interface WorkspaceMigrationPlanItem {
	/** Unique migration id */
	migrationId: WorkspaceMigrationId;
	/** Source schema version */
	fromVersion: WorkspaceSchemaVersion;
	/** Target schema version */
	toVersion: WorkspaceSchemaVersion;
	/** Human-readable description */
	description: string;
	/** State files affected by this migration */
	affectedStateFiles: string[];
	/** Preconditions that must be met */
	preconditions: string[];
	/** Postconditions expected after migration */
	postconditions: string[];
	/** Risks or warnings */
	warnings: string[];
	/** Whether this migration is blocked */
	blocked: boolean;
	/** Why blocked, if blocked */
	blockedReason?: string | undefined;
	/** Expected changed paths after migration (relative to workspace) */
	expectedChangedPaths: string[];
	/** Order index in the migration sequence */
	orderIndex: number;
}

// ---------------------------------------------------------------------------
// Migration Plan
// ---------------------------------------------------------------------------

export interface WorkspaceMigrationPlan {
	/** Source detected version */
	fromVersion: WorkspaceSchemaVersion;
	/** Target version to migrate to */
	toVersion: WorkspaceSchemaVersion;
	/** Migration direction */
	direction: WorkspaceMigrationDirection;
	/** Ordered list of migration plan items */
	items: WorkspaceMigrationPlanItem[];
	/** Whether any items are blocked */
	hasBlocked: boolean;
	/** Whether backup is required */
	backupRequired: boolean;
	/** Overall status */
	status: WorkspaceMigrationStatus;
	/** Total migration count */
	migrationCount: number;
	/** Whether this is a dry-run plan */
	dryRun: boolean;
	/** Estimated operation count */
	estimatedOperationCount: number;
	/** Aggregate warnings */
	warnings: string[];
	/** Aggregate blockers */
	blockers: string[];
	/** Affected state paths (relative to workspace) */
	affectedPaths: string[];
}

// ---------------------------------------------------------------------------
// Migration Result
// ---------------------------------------------------------------------------

export interface WorkspaceMigrationResult {
	/** Whether the migration succeeded */
	success: boolean;
	/** Overall status */
	status: WorkspaceMigrationStatus;
	/** Source version */
	fromVersion: WorkspaceSchemaVersion;
	/** Resulting version */
	toVersion: WorkspaceSchemaVersion;
	/** Applied migration ids */
	appliedMigrations: WorkspaceMigrationId[];
	/** Changed paths (absolute or relative, depending on context) */
	changedPaths: WorkspaceMigrationChangedPath[];
	/** Backup path if created */
	backupPath?: string | undefined;
	/** Backup id if created */
	backupId?: string | undefined;
	/** Diagnostics */
	diagnostics: WorkspaceMigrationDiagnostic[];
	/** Whether this was a dry-run */
	dryRun: boolean;
	/** Recovery hints for partial/failed migrations */
	recoveryHints: string[];
	/** Partial failure details */
	partialFailure?:
		| {
				completedMigrations: WorkspaceMigrationId[];
				failedMigration: WorkspaceMigrationId;
				failedAfterMutation: boolean;
		  }
		| undefined;
}

// ---------------------------------------------------------------------------
// Migration Changed Path
// ---------------------------------------------------------------------------

export interface WorkspaceMigrationChangedPath {
	path: string;
	role: 'created' | 'updated' | 'backed_up' | 'planned' | 'failed';
}

// ---------------------------------------------------------------------------
// Migration Diagnostic
// ---------------------------------------------------------------------------

export interface WorkspaceMigrationDiagnostic {
	code: string;
	severity: 'error' | 'warning' | 'info';
	message: string;
	path?: string | undefined;
	recoveryHint?: string | undefined;
}

// ---------------------------------------------------------------------------
// Backup Types
// ---------------------------------------------------------------------------

export interface WorkspaceBackupManifest {
	/** Unique backup id */
	backupId: string;
	/** ISO timestamp of backup creation */
	createdAt: string;
	/** Schema version at time of backup */
	schemaVersion: WorkspaceSchemaVersion;
	/** Project root at time of backup (relative) */
	sourceWorkspacePath: string;
	/** Reason for backup */
	reason: string;
	/** Associated migration id if applicable */
	migrationId?: string | undefined;
	/** Associated run id if applicable */
	runId?: string | undefined;
	/** Included relative file paths */
	includedPaths: string[];
	/** Checksums for included files (relative path -> checksum) */
	checksums: Record<string, string>;
	/** File sizes for included files (relative path -> bytes) */
	fileSizes: Record<string, number>;
	/** Categories of state backed up */
	categories: string[];
	/** Security redaction summary */
	redactionSummary?: string | undefined;
	/** Manifest format version */
	manifestVersion: string;
}

export interface WorkspaceBackupOptions {
	/** Project root directory */
	projectRoot: string;
	/** Backup root directory (default: .logos/backups) */
	backupRoot?: string | undefined;
	/** Reason for backup */
	reason?: string | undefined;
	/** Associated migration id */
	migrationId?: string | undefined;
	/** Associated run id */
	runId?: string | undefined;
	/** Dry-run mode */
	dryRun?: boolean | undefined;
	/** Injected filesystem adapter */
	_fs?: import('../fs/safe-filesystem.js').SafeFsAdapter | undefined;
	/** Deterministic timestamp */
	_testTimestamp?: string | undefined;
	/** Deterministic random ID */
	_testRandomId?: string | undefined;
}

export interface WorkspaceBackupResult {
	success: boolean;
	status: WorkspaceBackupStatus;
	backupId?: string | undefined;
	backupPath?: string | undefined;
	manifestPath?: string | undefined;
	manifest?: WorkspaceBackupManifest | undefined;
	changedPaths: WorkspaceMigrationChangedPath[];
	diagnostics: WorkspaceMigrationDiagnostic[];
	dryRun: boolean;
	integrityResult?: WorkspaceBackupIntegrityResult | undefined;
}

export interface WorkspaceBackupIntegrityResult {
	valid: boolean;
	status: 'valid' | 'invalid' | 'warning';
	diagnostics: WorkspaceMigrationDiagnostic[];
	checkedPaths: string[];
	checksumMismatches: string[];
	missingPaths: string[];
}

// ---------------------------------------------------------------------------
// Restore Types
// ---------------------------------------------------------------------------

export interface WorkspaceRestoreOptions {
	/** Project root directory */
	projectRoot: string;
	/** Path to the backup manifest file */
	manifestPath: string;
	/** Dry-run mode */
	dryRun?: boolean | undefined;
	/** Injected filesystem adapter */
	_fs?: import('../fs/safe-filesystem.js').SafeFsAdapter | undefined;
	/** Deterministic timestamp */
	_testTimestamp?: string | undefined;
	/** Deterministic random ID */
	_testRandomId?: string | undefined;
}

export interface WorkspaceRestoreResult {
	success: boolean;
	status: WorkspaceBackupStatus;
	manifest?: WorkspaceBackupManifest | undefined;
	plan?: WorkspaceRestorePlan | undefined;
	changedPaths: WorkspaceMigrationChangedPath[];
	preRestoreBackupId?: string | undefined;
	diagnostics: WorkspaceMigrationDiagnostic[];
	dryRun: boolean;
	recoveryHints: string[];
}

export interface WorkspaceRestorePlan {
	/** Source backup manifest */
	manifest: WorkspaceBackupManifest;
	/** Target paths where files will be restored */
	targetPaths: string[];
	/** Collision risks (existing files that would be overwritten) */
	collisionPaths: string[];
	/** Order of restore operations */
	operationCount: number;
	/** Whether restore is blocked */
	blocked: boolean;
	/** Why blocked, if applicable */
	blockedReason?: string | undefined;
	/** Whether pre-restore backup will be created */
	preRestoreBackupRequired: boolean;
}

// ---------------------------------------------------------------------------
// Version Detection
// ---------------------------------------------------------------------------

/**
 * Parse a raw value from state JSON and determine the schema version status.
 */
export function detectSchemaVersion(
	rawState: unknown,
	currentVersion: WorkspaceSchemaVersion,
): {
	detectedVersion: WorkspaceSchemaVersion | undefined;
	detection: SchemaVersionDetection;
} {
	if (rawState === null || rawState === undefined) {
		return { detectedVersion: undefined, detection: 'missing' };
	}

	if (typeof rawState !== 'object') {
		return { detectedVersion: undefined, detection: 'corrupt' };
	}

	const stateObj = rawState as Record<string, unknown>;

	if (!('schemaVersion' in stateObj)) {
		return { detectedVersion: undefined, detection: 'missing' };
	}

	const version = stateObj.schemaVersion;

	if (typeof version !== 'string') {
		return { detectedVersion: undefined, detection: 'corrupt' };
	}

	if (version === currentVersion) {
		return { detectedVersion: version, detection: 'current' };
	}

	if (compareSchemaVersions(version, currentVersion) < 0) {
		return { detectedVersion: version, detection: 'older' };
	}

	if (compareSchemaVersions(version, currentVersion) > 0) {
		return { detectedVersion: version, detection: 'future' };
	}

	return { detectedVersion: version, detection: 'current' };
}

/**
 * Compare two schema version strings deterministically.
 *
 * Uses semver-like parsing: major.minor.patch.
 * Returns negative if a < b, positive if a > b, 0 if equal.
 */
export function compareSchemaVersions(
	a: WorkspaceSchemaVersion,
	b: WorkspaceSchemaVersion,
): number {
	const parse = (v: string): number[] => {
		const parts = v.split('.');
		return [
			Number.parseInt(parts[0] ?? '0', 10) || 0,
			Number.parseInt(parts[1] ?? '0', 10) || 0,
			Number.parseInt(parts[2] ?? '0', 10) || 0,
		];
	};

	const pa = parse(a);
	const pb = parse(b);

	for (let i = 0; i < 3; i++) {
		const ai = pa[i] ?? 0;
		const bi = pb[i] ?? 0;
		if (ai !== bi) return ai - bi;
	}

	return 0;
}

/**
 * Build a safe backup ID from a timestamp and random suffix.
 */
export function buildBackupId(timestamp: string, randomSuffix: string): string {
	const ts = timestamp.replace(/[:.]/g, '-').slice(0, 19);
	return `backup-${ts}-${randomSuffix}`;
}

/**
 * Build a deterministic backup ID for tests.
 */
export const DETERMINISTIC_BACKUP_ID = 'backup-2024-01-01T00-00-00-test01';
