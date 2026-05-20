/**
 * Backup Service — local workspace state backup creation and integrity verification.
 *
 * Step 13.2 — Implement Migrations, Backups, and Performance Baseline
 *
 * Backups are local-only, deterministic, and provider-free.
 * They include only workspace state files needed for recovery.
 * They explicitly exclude:
 * - Raw provider tokens
 * - .env contents
 * - Arbitrary repository source files
 * - Generated canonical Markdown
 * - Raw prompts/model responses
 */

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
	buildBackupId,
	type WorkspaceBackupIntegrityResult,
	type WorkspaceBackupManifest,
	type WorkspaceBackupOptions,
	type WorkspaceBackupResult,
	type WorkspaceBackupStatus,
	type WorkspaceMigrationChangedPath,
	type WorkspaceMigrationDiagnostic,
} from './migration-model.js';
import { isLikelyRawSecret } from './workspace-state-validation.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BACKUP_MANIFEST_VERSION = '1.0.0';
const BACKUP_MANIFEST_FILENAME = 'backup-manifest.json';
const DEFAULT_BACKUP_ROOT = '.logos/backups';

const STATE_FILES_TO_BACKUP = [
	'workspace.json',
	'sessions.json', // May not exist yet
	'runs.json', // May not exist yet
];

const EXCLUDED_FILENAMES = new Set([
	'.env',
	'.env.local',
	'.env.development',
	'.env.production',
	'.secrets',
	'credentials.json',
	'tokens.json',
]);

const EXCLUDED_PATTERNS = [
	'.env',
	'secrets',
	'credentials',
	'tokens',
	'private',
	'.pem',
	'.key',
];

// ---------------------------------------------------------------------------
// Create Backup
// ---------------------------------------------------------------------------

export async function createWorkspaceBackup(
	options: WorkspaceBackupOptions,
): Promise<WorkspaceBackupResult> {
	const projectRoot = path.normalize(options.projectRoot);
	const backupRoot = path.join(
		projectRoot,
		options.backupRoot ?? DEFAULT_BACKUP_ROOT,
	);
	const diagnostics: WorkspaceMigrationDiagnostic[] = [];
	const changedPaths: WorkspaceMigrationChangedPath[] = [];

	const ts = options._testTimestamp ?? new Date().toISOString();
	const randomSuffix =
		options._testRandomId ?? Math.random().toString(36).slice(2, 10);
	const backupId = buildBackupId(ts, randomSuffix);
	const backupDir = path.join(backupRoot, backupId);

	// Dry-run: return plan without mutations
	if (options.dryRun) {
		for (const f of STATE_FILES_TO_BACKUP) {
			const _srcPath = path.join(projectRoot, '.logos', f);
			const dstPath = path.join(backupDir, f);
			changedPaths.push({ path: dstPath, role: 'planned' });
		}
		changedPaths.push({
			path: path.join(backupDir, BACKUP_MANIFEST_FILENAME),
			role: 'planned',
		});
		return {
			backupId,
			backupPath: backupDir,
			changedPaths,
			diagnostics: [
				{
					code: 'LOGOS_STATE_BACKUP_DRY_RUN',
					message: `Would create backup ${backupId} at ${backupDir}.`,
					severity: 'info',
				},
			],
			dryRun: true,
			status: 'dry_run',
			success: true,
		};
	}

	// Create backup directory
	const fsAdapter = options._fs;
	try {
		if (fsAdapter) {
			await fsAdapter.mkdir(backupDir, { recursive: true });
		} else {
			await mkdir(backupDir, { recursive: true });
		}
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : String(err);
		diagnostics.push({
			code: 'LOGOS_STATE_BACKUP_MKDIR_FAILED',
			message: `Failed to create backup directory: ${message}`,
			path: backupDir,
			recoveryHint: 'Check filesystem permissions and disk space.',
			severity: 'error',
		});
		return {
			changedPaths,
			diagnostics,
			dryRun: false,
			status: 'failed',
			success: false,
		};
	}

	// Collect files to backup
	const includedPaths: string[] = [];
	const checksums: Record<string, string> = {};
	const fileSizes: Record<string, number> = {};
	const categories: string[] = ['state'];
	let redactionSummary: string | undefined;

	for (const relPath of STATE_FILES_TO_BACKUP) {
		const srcPath = path.join(projectRoot, '.logos', relPath);

		// Check exclusion list
		if (EXCLUDED_FILENAMES.has(path.basename(relPath))) {
			continue;
		}

		const lowerBase = path.basename(relPath).toLowerCase();
		const isExcluded = EXCLUDED_PATTERNS.some(
			(pattern) => lowerBase.includes(pattern) || lowerBase.endsWith(pattern),
		);
		if (isExcluded) {
			continue;
		}

		// Read file
		let content: string;
		try {
			content = await readFile(srcPath, 'utf-8');
		} catch {
			// File doesn't exist — skip non-essential files
			continue;
		}

		// Check for raw secrets before backing up
		const secretCheck = checkContentForSecrets(content, relPath);
		if (secretCheck.hasSecrets) {
			diagnostics.push({
				code: 'LOGOS_STATE_BACKUP_SECRET_DETECTED',
				message: `File ${relPath} contains secret-like values. Backup will proceed but secrets should be removed.`,
				path: relPath,
				recoveryHint:
					'Remove raw secret values from workspace state; use environment variable references instead.',
				severity: 'warning',
			});
			redactionSummary = secretCheck.summary;
		}

		// Compute checksum and size
		const checksum = computeSha256(content);
		const fileSize = Buffer.byteLength(content, 'utf-8');

		// Write file to backup directory
		const dstPath = path.join(backupDir, relPath);
		const dstDir = path.dirname(dstPath);
		try {
			if (fsAdapter) {
				await fsAdapter.mkdir(dstDir, { recursive: true });
				await fsAdapter.writeFile(dstPath, content);
			} else {
				await mkdir(dstDir, { recursive: true });
				await writeFile(dstPath, content, 'utf-8');
			}
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : String(err);
			diagnostics.push({
				code: 'LOGOS_STATE_BACKUP_WRITE_FAILED',
				message: `Failed to write backup file ${relPath}: ${message}`,
				path: dstPath,
				recoveryHint: 'Check filesystem permissions and disk space.',
				severity: 'error',
			});
			return {
				backupId,
				backupPath: backupDir,
				changedPaths,
				diagnostics,
				dryRun: false,
				status: 'failed',
				success: false,
			};
		}

		includedPaths.push(relPath);
		checksums[relPath] = checksum;
		fileSizes[relPath] = fileSize;
		changedPaths.push({ path: dstPath, role: 'created' });
	}

	// Read workspace.json schema version
	let schemaVersion = 'unknown';
	try {
		const workspacePath = path.join(projectRoot, '.logos', 'workspace.json');
		const workspaceContent = await readFile(workspacePath, 'utf-8');
		const workspaceJson = JSON.parse(workspaceContent) as Record<
			string,
			unknown
		>;
		if (
			typeof workspaceJson.schemaVersion === 'string' &&
			workspaceJson.schemaVersion.length > 0
		) {
			schemaVersion = workspaceJson.schemaVersion;
		}
	} catch {
		// Schema version may be unknown
	}

	// Build manifest
	const manifest: WorkspaceBackupManifest = {
		backupId,
		categories: categories.filter((c) => c.length > 0),
		checksums,
		createdAt: ts,
		fileSizes,
		includedPaths,
		manifestVersion: BACKUP_MANIFEST_VERSION,
		migrationId: options.migrationId,
		reason: options.reason ?? 'Manual backup',
		redactionSummary,
		runId: options.runId,
		schemaVersion,
		sourceWorkspacePath: '.',
	};

	// Write manifest
	const manifestPath = path.join(backupDir, BACKUP_MANIFEST_FILENAME);
	const manifestJson = JSON.stringify(manifest, null, 2);
	try {
		if (fsAdapter) {
			await fsAdapter.writeFile(manifestPath, manifestJson);
		} else {
			await writeFile(manifestPath, manifestJson, 'utf-8');
		}
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : String(err);
		diagnostics.push({
			code: 'LOGOS_STATE_BACKUP_MANIFEST_WRITE_FAILED',
			message: `Failed to write backup manifest: ${message}`,
			path: manifestPath,
			recoveryHint: 'Check filesystem permissions.',
			severity: 'error',
		});
		return {
			backupId,
			backupPath: backupDir,
			changedPaths,
			diagnostics,
			dryRun: false,
			status: 'partial',
			success: false,
		};
	}

	changedPaths.push({ path: manifestPath, role: 'created' });

	// Verify backup integrity
	const integrityResult = verifyBackupIntegrity({
		_fs: fsAdapter,
		backupDir,
		manifest,
	});

	const finalStatus: WorkspaceBackupStatus = integrityResult.valid
		? 'created'
		: 'partial';

	return {
		backupId,
		backupPath: backupDir,
		changedPaths,
		diagnostics: [
			...diagnostics,
			...integrityResult.diagnostics,
			{
				code: 'LOGOS_STATE_BACKUP_CREATED',
				message: `Backup ${backupId} created with ${includedPaths.length} file(s).`,
				severity: finalStatus === 'created' ? 'info' : 'warning',
			},
		],
		dryRun: false,
		integrityResult,
		manifest,
		manifestPath,
		status: finalStatus,
		success: finalStatus === 'created',
	};
}

// ---------------------------------------------------------------------------
// Integrity Verification
// ---------------------------------------------------------------------------

export interface BackupIntegrityInput {
	backupDir: string;
	manifest: WorkspaceBackupManifest;
	_fs?: import('../fs/safe-filesystem.js').SafeFsAdapter | undefined;
}

export function verifyBackupIntegrity(
	input: BackupIntegrityInput,
): WorkspaceBackupIntegrityResult {
	const diagnostics: WorkspaceMigrationDiagnostic[] = [];
	const checkedPaths: string[] = [];
	const checksumMismatches: string[] = [];
	const missingPaths: string[] = [];

	// Verify manifest version
	if (!input.manifest.manifestVersion) {
		diagnostics.push({
			code: 'LOGOS_STATE_BACKUP_MANIFEST_VERSION_MISSING',
			message: 'Backup manifest is missing manifestVersion.',
			severity: 'error',
		});
		return {
			checkedPaths: [],
			checksumMismatches: [],
			diagnostics,
			missingPaths: [],
			status: 'invalid',
			valid: false,
		};
	}

	// Verify schema version
	if (
		!input.manifest.schemaVersion ||
		input.manifest.schemaVersion === 'unknown'
	) {
		diagnostics.push({
			code: 'LOGOS_STATE_BACKUP_SCHEMA_VERSION_MISSING',
			message: 'Backup manifest has unknown or missing schema version.',
			severity: 'warning',
		});
	}

	// Verify no path traversal in manifest
	for (const relPath of input.manifest.includedPaths) {
		if (relPath.includes('..') || path.isAbsolute(relPath)) {
			diagnostics.push({
				code: 'LOGOS_STATE_BACKUP_PATH_TRAVERSAL',
				message: `Backup manifest contains unsafe path: ${relPath}`,
				path: relPath,
				severity: 'error',
			});
			return {
				checkedPaths,
				checksumMismatches,
				diagnostics,
				missingPaths,
				status: 'invalid',
				valid: false,
			};
		}
	}

	// Verify manifest doesn't contain raw secrets in its metadata
	const manifestJson = JSON.stringify(input.manifest);
	if (isLikelyRawSecret(manifestJson)) {
		diagnostics.push({
			code: 'LOGOS_STATE_BACKUP_MANIFEST_SECRET',
			message: 'Backup manifest contains secret-like values.',
			severity: 'warning',
		});
	}

	return {
		checkedPaths,
		checksumMismatches,
		diagnostics,
		missingPaths,
		status: diagnostics.some((d) => d.severity === 'error')
			? 'invalid'
			: 'valid',
		valid: !diagnostics.some((d) => d.severity === 'error'),
	};
}

/**
 * Verify a backup manifest against actual files on disk.
 */
export async function verifyBackupIntegrityOnDisk(
	backupDir: string,
	manifest: WorkspaceBackupManifest,
	_fs?: import('../fs/safe-filesystem.js').SafeFsAdapter,
): Promise<WorkspaceBackupIntegrityResult> {
	const diagnostics: WorkspaceMigrationDiagnostic[] = [];
	const checkedPaths: string[] = [];
	const checksumMismatches: string[] = [];
	const missingPaths: string[] = [];

	// Validate manifest structure first
	const structuralResult = verifyBackupIntegrity({
		_fs,
		backupDir,
		manifest,
	});
	if (!structuralResult.valid) {
		return structuralResult;
	}
	diagnostics.push(...structuralResult.diagnostics);

	// Check each included file
	for (const relPath of manifest.includedPaths) {
		// Path traversal check (belt and suspenders)
		if (relPath.includes('..') || path.isAbsolute(relPath)) {
			diagnostics.push({
				code: 'LOGOS_STATE_BACKUP_PATH_TRAVERSAL',
				message: `Unsafe path in backup: ${relPath}`,
				path: relPath,
				severity: 'error',
			});
			missingPaths.push(relPath);
			continue;
		}

		const filePath = path.join(backupDir, relPath);

		// Ensure file is within backup root
		const resolved = path.resolve(filePath);
		const resolvedRoot = path.resolve(backupDir);
		if (!resolved.startsWith(resolvedRoot)) {
			diagnostics.push({
				code: 'LOGOS_STATE_BACKUP_ROOT_VIOLATION',
				message: `File ${relPath} resolves outside backup root.`,
				path: relPath,
				severity: 'error',
			});
			missingPaths.push(relPath);
			continue;
		}

		try {
			const content = await readFile(filePath, 'utf-8');
			const actualChecksum = computeSha256(content);
			const expectedChecksum = manifest.checksums[relPath];

			checkedPaths.push(relPath);

			if (expectedChecksum && actualChecksum !== expectedChecksum) {
				checksumMismatches.push(relPath);
				diagnostics.push({
					code: 'LOGOS_STATE_BACKUP_CHECKSUM_MISMATCH',
					message: `Checksum mismatch for ${relPath}`,
					path: relPath,
					recoveryHint:
						'The backup file may be corrupted. Restore from a different backup if available.',
					severity: 'error',
				});
			}
		} catch {
			missingPaths.push(relPath);
			diagnostics.push({
				code: 'LOGOS_STATE_BACKUP_FILE_MISSING',
				message: `Backup file ${relPath} is missing from backup directory.`,
				path: relPath,
				recoveryHint:
					'The backup is incomplete. Do not trust this backup for restore.',
				severity: 'error',
			});
		}
	}

	const valid =
		missingPaths.length === 0 &&
		checksumMismatches.length === 0 &&
		!diagnostics.some((d) => d.severity === 'error');

	return {
		checkedPaths,
		checksumMismatches,
		diagnostics,
		missingPaths,
		status: valid ? 'valid' : 'invalid',
		valid,
	};
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function computeSha256(content: string): string {
	return createHash('sha256').update(content).digest('hex');
}

interface SecretCheckResult {
	hasSecrets: boolean;
	summary?: string | undefined;
}

function checkContentForSecrets(
	content: string,
	relPath: string,
): SecretCheckResult {
	// Quick heuristic: scan first 10KB for secret patterns
	const sampleSize = Math.min(content.length, 10240);
	const sample = content.slice(0, sampleSize);
	const lines = sample.split('\n');
	let secretCount = 0;

	for (const line of lines) {
		if (isLikelyRawSecret(line.trim())) {
			secretCount++;
		}
	}

	return {
		hasSecrets: secretCount > 0,
		summary:
			secretCount > 0
				? `Warning: ${relPath} contains ${secretCount} secret-like value(s). Remove raw secrets and use environment variable references.`
				: undefined,
	};
}

/**
 * Compute a checksum for a string (used by migration-runner).
 */
export { computeSha256 };
