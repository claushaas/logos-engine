/**
 * Restore Service — safe workspace state restoration from local backups.
 *
 * Step 13.2 — Implement Migrations, Backups, and Performance Baseline
 *
 * Restores are local-only, deterministic, and provider-free.
 * Key safety properties:
 * - Reads manifest before touching any files
 * - Dry-run shows plan without writes
 * - Creates pre-restore backup before overwriting current state
 * - Validates restored state after restore
 * - Blocks path traversal and unsafe writes
 * - Reports precise diagnostics on failure
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
	createWorkspaceBackup,
	verifyBackupIntegrityOnDisk,
} from './backup-service.js';
import type {
	WorkspaceBackupManifest,
	WorkspaceMigrationChangedPath,
	WorkspaceMigrationDiagnostic,
	WorkspaceRestoreOptions,
	WorkspaceRestorePlan,
	WorkspaceRestoreResult,
} from './migration-model.js';
import { validateWorkspaceState } from './workspace-state-validation.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const _BACKUP_MANIFEST_FILENAME = 'backup-manifest.json';

// ---------------------------------------------------------------------------
// Plan
// ---------------------------------------------------------------------------

/**
 * Create a restore plan from a backup manifest without writing anything.
 */
export function planRestore(
	manifest: WorkspaceBackupManifest,
	projectRoot: string,
): WorkspaceRestorePlan {
	const targetPaths: string[] = [];
	const collisionPaths: string[] = [];

	for (const relPath of manifest.includedPaths) {
		const targetPath = path.join(projectRoot, '.logos', relPath);
		targetPaths.push(targetPath);

		// Check if the target file already exists
		// We don't stat here to keep planning pure; collision detection happens during actual restore
		// For planning purposes, assume all existing .logos files are potential collisions
		if (manifest.includedPaths.includes(relPath)) {
			// Will be checked during execution
		}
	}

	const blocked = false;
	const preRestoreBackupRequired = true;

	return {
		blocked,
		collisionPaths, // Will be populated during execution
		manifest,
		operationCount: targetPaths.length + (preRestoreBackupRequired ? 1 : 0),
		preRestoreBackupRequired,
		targetPaths,
	};
}

// ---------------------------------------------------------------------------
// Execute
// ---------------------------------------------------------------------------

export async function restoreWorkspaceFromBackup(
	options: WorkspaceRestoreOptions,
): Promise<WorkspaceRestoreResult> {
	const projectRoot = path.normalize(options.projectRoot);
	const diagnostics: WorkspaceMigrationDiagnostic[] = [];
	const changedPaths: WorkspaceMigrationChangedPath[] = [];
	const _recoveryHints: string[] = [];

	// Read manifest
	let manifestJson: string;
	try {
		manifestJson = await readFile(options.manifestPath, 'utf-8');
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : String(err);
		diagnostics.push({
			code: 'LOGOS_STATE_RESTORE_MANIFEST_READ_FAILED',
			message: `Failed to read backup manifest: ${message}`,
			path: options.manifestPath,
			recoveryHint: 'Ensure the backup directory and manifest file exist.',
			severity: 'error',
		});
		return {
			changedPaths: [],
			diagnostics,
			dryRun: options.dryRun ?? false,
			recoveryHints: ['Check backup directory path and permissions.'],
			status: 'failed',
			success: false,
		};
	}

	let manifest: WorkspaceBackupManifest;
	try {
		manifest = JSON.parse(manifestJson) as WorkspaceBackupManifest;
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : String(err);
		diagnostics.push({
			code: 'LOGOS_STATE_RESTORE_MANIFEST_PARSE_FAILED',
			message: `Backup manifest is not valid JSON: ${message}`,
			path: options.manifestPath,
			recoveryHint: 'The backup manifest may be corrupted.',
			severity: 'error',
		});
		return {
			changedPaths: [],
			diagnostics,
			dryRun: options.dryRun ?? false,
			recoveryHints: [],
			status: 'failed',
			success: false,
		};
	}

	// Validate manifest has required fields
	if (!manifest.backupId || !manifest.includedPaths) {
		diagnostics.push({
			code: 'LOGOS_STATE_RESTORE_MANIFEST_INCOMPLETE',
			message:
				'Backup manifest is missing required fields (backupId, includedPaths).',
			path: options.manifestPath,
			severity: 'error',
		});
		return {
			changedPaths: [],
			diagnostics,
			dryRun: options.dryRun ?? false,
			manifest,
			recoveryHints: [],
			status: 'failed',
			success: false,
		};
	}

	// Check for path traversal in manifest
	for (const relPath of manifest.includedPaths) {
		if (relPath.includes('..') || path.isAbsolute(relPath)) {
			diagnostics.push({
				code: 'LOGOS_STATE_RESTORE_PATH_TRAVERSAL',
				message: `Backup manifest contains unsafe path: ${relPath}`,
				path: relPath,
				severity: 'error',
			});
			return {
				changedPaths: [],
				diagnostics,
				dryRun: options.dryRun ?? false,
				manifest,
				recoveryHints: [
					'The backup manifest contains unsafe paths. Do not restore from this backup.',
				],
				status: 'blocked',
				success: false,
			};
		}
	}

	// Verify backup integrity
	const backupDir = path.dirname(options.manifestPath);
	const integrityResult = await verifyBackupIntegrityOnDisk(
		backupDir,
		manifest,
		options._fs,
	);
	if (!integrityResult.valid) {
		for (const d of integrityResult.diagnostics) {
			diagnostics.push(d);
		}
		return {
			changedPaths: [],
			diagnostics,
			dryRun: options.dryRun ?? false,
			manifest,
			recoveryHints: [
				'Backup integrity check failed. Do not restore from a corrupt backup.',
			],
			status: 'blocked',
			success: false,
		};
	}

	// Build restore plan
	const plan = planRestore(manifest, projectRoot);

	// Detect collisions
	const { stat: fsStat } = await import('node:fs/promises');
	for (const relPath of manifest.includedPaths) {
		const targetPath = path.join(projectRoot, '.logos', relPath);
		try {
			await fsStat(targetPath);
			plan.collisionPaths.push(targetPath);
		} catch {
			// File does not exist — no collision
		}
	}

	// Dry-run: return plan without writes
	if (options.dryRun) {
		for (const tp of plan.targetPaths) {
			changedPaths.push({ path: tp, role: 'planned' });
		}
		return {
			changedPaths,
			diagnostics: [
				{
					code: 'LOGOS_STATE_RESTORE_DRY_RUN',
					message: `Would restore ${plan.targetPaths.length} file(s) from backup ${manifest.backupId}.`,
					severity: 'info',
				},
			],
			dryRun: true,
			manifest,
			plan,
			recoveryHints: ['Run restore without --dry-run to apply changes.'],
			status: 'dry_run',
			success: true,
		};
	}

	// Create pre-restore backup
	let preRestoreBackupId: string | undefined;
	if (plan.collisionPaths.length > 0) {
		const preRestoreResult = await createWorkspaceBackup({
			_fs: options._fs,
			_testRandomId: options._testRandomId,
			_testTimestamp: options._testTimestamp,
			dryRun: false,
			projectRoot,
			reason: `Pre-restore backup before restoring from backup ${manifest.backupId}`,
		});

		if (!preRestoreResult.success) {
			for (const d of preRestoreResult.diagnostics) {
				diagnostics.push(d);
			}
			diagnostics.push({
				code: 'LOGOS_STATE_RESTORE_PRE_BACKUP_FAILED',
				message:
					'Failed to create pre-restore backup. Restore blocked to protect current state.',
				recoveryHint: 'Check filesystem permissions and disk space.',
				severity: 'error',
			});
			return {
				changedPaths,
				diagnostics,
				dryRun: false,
				manifest,
				plan,
				recoveryHints: ['Resolve pre-restore backup failure before retrying.'],
				status: 'blocked',
				success: false,
			};
		}

		preRestoreBackupId = preRestoreResult.backupId;
		for (const cp of preRestoreResult.changedPaths) {
			changedPaths.push(cp);
		}
	}

	// Restore files
	const fsAdapter = options._fs;
	let restoreFailed = false;

	for (const relPath of manifest.includedPaths) {
		const sourcePath = path.join(backupDir, relPath);
		const targetPath = path.join(projectRoot, '.logos', relPath);

		// Safety check: ensure target is within project root
		const resolvedTarget = path.resolve(targetPath);
		const resolvedRoot = path.resolve(projectRoot);
		if (!resolvedTarget.startsWith(resolvedRoot)) {
			diagnostics.push({
				code: 'LOGOS_STATE_RESTORE_ROOT_VIOLATION',
				message: `Target path ${relPath} resolves outside project root; blocked.`,
				path: relPath,
				severity: 'error',
			});
			restoreFailed = true;
			continue;
		}

		try {
			const content = await readFile(sourcePath, 'utf-8');

			// Create parent directories
			const targetDir = path.dirname(targetPath);
			if (fsAdapter) {
				await fsAdapter.mkdir(targetDir, { recursive: true });
				await fsAdapter.writeFile(targetPath, content);
			} else {
				await mkdir(targetDir, { recursive: true });
				await writeFile(targetPath, content, 'utf-8');
			}

			changedPaths.push({ path: targetPath, role: 'updated' });
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : String(err);
			diagnostics.push({
				code: 'LOGOS_STATE_RESTORE_WRITE_FAILED',
				message: `Failed to restore file ${relPath}: ${message}`,
				path: targetPath,
				recoveryHint: 'Check filesystem permissions.',
				severity: 'error',
			});
			restoreFailed = true;
		}
	}

	if (restoreFailed) {
		return {
			changedPaths,
			diagnostics,
			dryRun: false,
			manifest,
			plan,
			preRestoreBackupId,
			recoveryHints: [
				'Restore partially failed. Some files may be in inconsistent state.',
				preRestoreBackupId
					? `Pre-restore backup available at: ${preRestoreBackupId}`
					: 'No pre-restore backup was created.',
			],
			status: 'partial',
			success: false,
		};
	}

	// Validate restored workspace state
	const workspacePath = path.join(projectRoot, '.logos', 'workspace.json');
	try {
		const workspaceJson = await readFile(workspacePath, 'utf-8');
		const workspaceState = JSON.parse(workspaceJson) as unknown;
		const validation = validateWorkspaceState(workspaceState);

		if (!validation.success) {
			for (const err of validation.errors) {
				diagnostics.push({
					code: `LOGOS_STATE_RESTORE_VALIDATION_${err.code}`,
					message: err.message,
					path: err.path,
					recoveryHint: err.recoveryHint,
					severity: 'error',
				});
			}
			return {
				changedPaths,
				diagnostics,
				dryRun: false,
				manifest,
				plan,
				preRestoreBackupId,
				recoveryHints: [
					'Restored state failed validation.',
					preRestoreBackupId
						? `Pre-restore backup available for rollback: ${preRestoreBackupId}`
						: undefined,
				].filter((h): h is string => h !== undefined),
				status: 'partial',
				success: false,
			};
		}
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : String(err);
		diagnostics.push({
			code: 'LOGOS_STATE_RESTORE_VALIDATE_READ_FAILED',
			message: `Could not read restored workspace state for validation: ${message}`,
			path: workspacePath,
			severity: 'error',
		});
		return {
			changedPaths,
			diagnostics,
			dryRun: false,
			manifest,
			plan,
			preRestoreBackupId,
			recoveryHints: [],
			status: 'partial',
			success: false,
		};
	}

	diagnostics.push({
		code: 'LOGOS_STATE_RESTORE_SUCCESS',
		message: `Successfully restored ${manifest.includedPaths.length} file(s) from backup ${manifest.backupId}.`,
		severity: 'info',
	});

	return {
		changedPaths,
		diagnostics,
		dryRun: false,
		manifest,
		plan,
		preRestoreBackupId,
		recoveryHints: [],
		status: 'restored',
		success: true,
	};
}
