/** Safe Filesystem Adapter — atomic JSON writes, backups, dry-run, path safety, and diagnostics */

import { randomUUID } from 'node:crypto';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import {
	basename,
	dirname,
	extname,
	isAbsolute,
	join,
	normalize,
	relative,
	resolve,
	sep,
} from 'node:path';
import { isLikelyRawSecret } from '../state/workspace-state-validation.js';

// ---------------------------------------------------------------------------
// Overwrite Policy
// ---------------------------------------------------------------------------

export type SafeWritePolicy =
	| 'fail_if_exists'
	| 'overwrite'
	| 'backup_and_overwrite'
	| 'skip_if_exists'
	| 'create_only';

// ---------------------------------------------------------------------------
// Changed Path
// ---------------------------------------------------------------------------

export type SafeWriteChangedPathRole =
	| 'directory_created'
	| 'file_created'
	| 'file_updated'
	| 'backup_created'
	| 'skipped'
	| 'planned';

export interface SafeWriteChangedPath {
	path: string;
	role: SafeWriteChangedPathRole;
}

// ---------------------------------------------------------------------------
// Diagnostic
// ---------------------------------------------------------------------------

export interface SafeWriteDiagnostic {
	code: string;
	severity: 'error' | 'warning';
	message: string;
	targetPath?: string | undefined;
	backupPath?: string | undefined;
	operation?: string | undefined;
	recoveryHint?: string | undefined;
	cause?: unknown;
}

// ---------------------------------------------------------------------------
// Write Options
// ---------------------------------------------------------------------------

export interface PathSafetyOptions {
	allowedBaseDir?: string | undefined;
	allowDirectoryTarget?: boolean | undefined;
}

export interface BackupOptions {
	backupDir: string;
	deterministicTimestamp?: string | undefined;
}

export interface SafeWriteOptions {
	policy?: SafeWritePolicy | undefined;
	dryRun?: boolean | undefined;
	backupDir?: string | undefined;
	allowedBaseDir?: string | undefined;
	enableSecretRedaction?: boolean | undefined;
	indent?: number | undefined;
}

export interface AtomicJsonWriteOptions extends SafeWriteOptions {
	/** Caller may supply deterministic random IDs for tests */
	_testRandomId?: string | undefined;
	/** Caller may supply deterministic timestamps for tests */
	_testTimestamp?: string | undefined;
	/** Injected filesystem operations for failure simulation */
	_fs?: SafeFsAdapter | undefined;
}

// ---------------------------------------------------------------------------
// Result Envelope
// ---------------------------------------------------------------------------

export interface SafeWriteResult {
	success: boolean;
	targetPath: string;
	operation: string;
	changedPaths: SafeWriteChangedPath[];
	diagnostics: SafeWriteDiagnostic[];
	dryRun: boolean;
	backupPath?: string | undefined;
}

// ---------------------------------------------------------------------------
// Dry-Run Write Plan
// ---------------------------------------------------------------------------

export interface DryRunWritePlan {
	targetPath: string;
	wouldCreateDirectories: string[];
	wouldWriteFiles: string[];
	wouldBackupFiles: string[];
	wouldSkipFiles: string[];
	policy: SafeWritePolicy;
	changedPaths: SafeWriteChangedPath[];
}

// ---------------------------------------------------------------------------
// Backup Result
// ---------------------------------------------------------------------------

export interface BackupResult {
	originalPath: string;
	backupPath: string;
	timestamp: string;
	checksum?: string | undefined;
	status: 'created' | 'failed';
}

// ---------------------------------------------------------------------------
// Filesystem Adapter (for dependency injection / test hooks)
// ---------------------------------------------------------------------------

export interface SafeFsAdapter {
	mkdir(
		path: string,
		options?: { recursive?: boolean },
	): Promise<string | undefined>;
	writeFile(path: string, data: string | Uint8Array): Promise<void>;
	rename(oldPath: string, newPath: string): Promise<void>;
}

const nodeFsAdapter: SafeFsAdapter = {
	async mkdir(path: string, options?: { recursive?: boolean }) {
		return mkdir(path, { recursive: options?.recursive ?? false });
	},
	async rename(oldPath: string, newPath: string) {
		return rename(oldPath, newPath);
	},
	async writeFile(path: string, data: string | Uint8Array) {
		return writeFile(path, data, { encoding: 'utf-8', flush: true });
	},
};

// ---------------------------------------------------------------------------
// Path Safety
// ---------------------------------------------------------------------------

export interface PathSafetyCheckResult {
	safe: boolean;
	diagnostics: SafeWriteDiagnostic[];
}

export function checkPathSafety(
	targetPath: string,
	options: PathSafetyOptions = {},
): PathSafetyCheckResult {
	const diagnostics: SafeWriteDiagnostic[] = [];

	if (!targetPath || targetPath.trim() === '') {
		diagnostics.push({
			code: 'empty_target_path',
			message: 'Target path is empty and cannot be written.',
			operation: 'path_safety',
			recoveryHint: 'Provide a non-empty target path.',
			severity: 'error',
			targetPath,
		});
		return { diagnostics, safe: false };
	}

	const normalized = normalize(targetPath);

	if (options.allowedBaseDir) {
		const normalizedBase = normalize(options.allowedBaseDir);
		const rel = relative(normalizedBase, normalized);

		if (rel.startsWith('..') || isAbsolute(rel)) {
			diagnostics.push({
				code: 'path_traversal_rejected',
				message: `Target path is outside the allowed base directory.`,
				operation: 'path_safety',
				recoveryHint: `Ensure the target path is inside ${normalizedBase}.`,
				severity: 'error',
				targetPath: normalized,
			});
			return { diagnostics, safe: false };
		}
	}

	if (!options.allowDirectoryTarget) {
		const ext = extname(normalized);
		if (!ext && normalized.endsWith(sep)) {
			diagnostics.push({
				code: 'directory_target_rejected',
				message: `Target path appears to be a directory; file write requires a file path.`,
				operation: 'path_safety',
				recoveryHint: 'Provide a file path with an extension or filename.',
				severity: 'error',
				targetPath: normalized,
			});
			return { diagnostics, safe: false };
		}
	}

	return { diagnostics, safe: true };
}

// ---------------------------------------------------------------------------
// Policy Resolution
// ---------------------------------------------------------------------------

export interface PolicyCheckResult {
	allowed: boolean;
	action: 'write' | 'skip' | 'fail' | 'backup_then_write';
	diagnostics: SafeWriteDiagnostic[];
}

export function resolveWritePolicy(
	policy: SafeWritePolicy | undefined,
	targetPath: string,
	targetExists: boolean,
): PolicyCheckResult {
	if (!policy) {
		return {
			action: 'fail',
			allowed: false,
			diagnostics: [
				{
					code: 'policy_required',
					message: `No writin policy specified; cannot proceed with write to "${targetPath}".`,
					operation: 'policy_check',
					recoveryHint:
						'Provide an explicit write policy (fail_if_exists, overwrite, backup_and_overwrite, skip_if_exists, create_only).',
					severity: 'error',
					targetPath,
				},
			],
		};
	}

	switch (policy) {
		case 'fail_if_exists':
			if (targetExists) {
				return {
					action: 'fail',
					allowed: false,
					diagnostics: [
						{
							code: 'write_collision',
							message: `Target already exists and policy "fail_if_exists" prevents overwrite.`,
							operation: 'policy_check',
							recoveryHint:
								'Use overwrite, backup_and_overwrite, or skip_if_exists policies to handle existing files.',
							severity: 'error',
							targetPath,
						},
					],
				};
			}
			return { action: 'write', allowed: true, diagnostics: [] };

		case 'create_only':
			if (targetExists) {
				return {
					action: 'fail',
					allowed: false,
					diagnostics: [
						{
							code: 'write_collision',
							message: `Target already exists and policy "create_only" prevents modifying existing files.`,
							operation: 'policy_check',
							recoveryHint:
								'Use overwrite, backup_and_overwrite, or skip_if_exists to handle the existing file.',
							severity: 'error',
							targetPath,
						},
					],
				};
			}
			return { action: 'write', allowed: true, diagnostics: [] };

		case 'skip_if_exists':
			if (targetExists) {
				return {
					action: 'skip',
					allowed: true,
					diagnostics: [
						{
							code: 'write_skipped',
							message: `Target already exists; policy "skip_if_exists" skips the write.`,
							operation: 'policy_check',
							recoveryHint:
								'Use overwrite or backup_and_overwrite to replace the existing file.',
							severity: 'warning',
							targetPath,
						},
					],
				};
			}
			return { action: 'write', allowed: true, diagnostics: [] };

		case 'overwrite':
			if (targetExists) {
				return {
					action: 'write',
					allowed: true,
					diagnostics: [
						{
							code: 'overwrite_explicit',
							message: `Target exists; explicit "overwrite" policy will replace the file.`,
							operation: 'policy_check',
							recoveryHint:
								'Use backup_and_overwrite to retain a backup before overwriting.',
							severity: 'warning',
							targetPath,
						},
					],
				};
			}
			return { action: 'write', allowed: true, diagnostics: [] };

		case 'backup_and_overwrite':
			if (targetExists) {
				return {
					action: 'backup_then_write',
					allowed: true,
					diagnostics: [],
				};
			}
			return {
				action: 'write',
				allowed: true,
				diagnostics: [
					{
						code: 'backup_not_needed',
						message: `Target does not exist; backup is not needed. Proceeding with write.`,
						operation: 'policy_check',
						severity: 'warning',
						targetPath,
					},
				],
			};

		default:
			return {
				action: 'fail',
				allowed: false,
				diagnostics: [
					{
						code: 'unknown_policy',
						message: `Unknown write policy "${policy as string}".`,
						operation: 'policy_check',
						recoveryHint:
							'Use one of: fail_if_exists, overwrite, backup_and_overwrite, skip_if_exists, create_only.',
						severity: 'error',
						targetPath,
					},
				],
			};
	}
}

// ---------------------------------------------------------------------------
// Serialization Safety
// ---------------------------------------------------------------------------

export interface SerializeResult {
	success: boolean;
	json?: string | undefined;
	error?: SafeWriteDiagnostic | undefined;
}

function isCircular(
	value: unknown,
	seen: WeakSet<object> = new WeakSet(),
): boolean {
	if (value === null || typeof value !== 'object') return false;
	if (seen.has(value)) return true;
	seen.add(value);
	if (Array.isArray(value)) {
		for (let i = 0; i < value.length; i++) {
			if (isCircular(value[i], seen)) return true;
		}
	} else {
		for (const v of Object.values(value as Record<string, unknown>)) {
			if (isCircular(v, seen)) return true;
		}
	}
	seen.delete(value);
	return false;
}

function sanitizeForJson(value: unknown, redact: boolean): unknown {
	if (value === null || value === undefined) return value;
	if (typeof value === 'string') {
		if (redact && isLikelyRawSecret(value)) {
			if (value.length <= 8) return '***';
			return `${value.slice(0, 3)}...${value.slice(-3)}`;
		}
		return value;
	}
	if (typeof value === 'number' || typeof value === 'boolean') return value;
	if (Array.isArray(value)) {
		return value.map((item) => sanitizeForJson(item, redact));
	}
	if (typeof value === 'object') {
		const result: Record<string, unknown> = {};
		for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
			result[key] = sanitizeForJson(val, redact);
		}
		return result;
	}
	return value;
}

export function serializeJson(
	value: unknown,
	options: { indent?: number; redactSecrets?: boolean },
): SerializeResult {
	if (typeof value === 'function' || typeof value === 'symbol') {
		return {
			error: {
				code: 'unserializable_value',
				message:
					'Value contains a function or symbol and cannot be serialized to JSON.',
				operation: 'serialize',
				recoveryHint: 'Ensure the value contains only JSON-compatible types.',
				severity: 'error',
			},
			success: false,
		};
	}

	if (typeof value === 'bigint') {
		return {
			error: {
				code: 'unserializable_value',
				message: 'BigInt values cannot be serialized to JSON.',
				operation: 'serialize',
				recoveryHint:
					'Convert BigInt values to strings or numbers before serialization.',
				severity: 'error',
			},
			success: false,
		};
	}

	if (value !== null && typeof value === 'object' && isCircular(value)) {
		return {
			error: {
				code: 'circular_structure',
				message:
					'Value contains a circular reference and cannot be serialized to JSON.',
				operation: 'serialize',
				recoveryHint:
					'Remove circular references before serialization or use a custom replacer.',
				severity: 'error',
			},
			success: false,
		};
	}

	const sanitized = sanitizeForJson(value, options.redactSecrets ?? false);
	const indent = options.indent ?? 2;

	try {
		const json = JSON.stringify(sanitized, null, indent);
		return { json: `${json}\n`, success: true };
	} catch (err: unknown) {
		return {
			error: {
				cause: err,
				code: 'serialize_failed',
				message: `JSON serialization failed: ${String(err)}`,
				operation: 'serialize',
				recoveryHint: 'Verify the value is JSON-compatible.',
				severity: 'error',
			},
			success: false,
		};
	}
}

// ---------------------------------------------------------------------------
// Backup
// ---------------------------------------------------------------------------

export async function createBackup(
	originalPath: string,
	options: BackupOptions,
	fs: SafeFsAdapter = nodeFsAdapter,
): Promise<BackupResult> {
	const normalized = normalize(originalPath);
	const base = basename(normalized);
	const ts =
		options.deterministicTimestamp ??
		new Date().toISOString().replace(/[:.]/g, '-');
	const backupName = `${ts}-${base}.bak`;
	const backupPath = join(options.backupDir, backupName);

	await fs.mkdir(options.backupDir, { recursive: true });

	// Read original and write backup
	const { readFile } = await import('node:fs/promises');
	let content: string | Uint8Array;
	try {
		content = await readFile(normalized, { encoding: 'utf-8' });
	} catch {
		// Try binary
		content = await readFile(normalized);
	}

	await fs.writeFile(backupPath, content);

	return {
		backupPath,
		originalPath: normalized,
		status: 'created',
		timestamp: options.deterministicTimestamp ?? new Date().toISOString(),
	};
}

// ---------------------------------------------------------------------------
// Atomic JSON Write
// ---------------------------------------------------------------------------

export async function writeJsonAtomic(
	targetPath: string,
	value: unknown,
	options: AtomicJsonWriteOptions = {},
): Promise<SafeWriteResult> {
	const fs = options._fs ?? nodeFsAdapter;
	const targetDir = dirname(normalize(targetPath));
	const normalizedTarget = normalize(targetPath);
	const changedPaths: SafeWriteChangedPath[] = [];
	const diagnostics: SafeWriteDiagnostic[] = [];

	// 1. Path safety check
	const pathSafety = checkPathSafety(normalizedTarget, {
		allowedBaseDir: options.allowedBaseDir,
	});
	diagnostics.push(...pathSafety.diagnostics);
	if (!pathSafety.safe) {
		return {
			changedPaths,
			diagnostics,
			dryRun: options.dryRun ?? false,
			operation: 'atomic_json_write',
			success: false,
			targetPath: normalizedTarget,
		};
	}

	// 2. Serialize
	const serialized = serializeJson(value, {
		indent: options.indent ?? 2,
		redactSecrets: options.enableSecretRedaction ?? false,
	});
	if (!serialized.success && serialized.error) {
		diagnostics.push(serialized.error);
		return {
			changedPaths,
			diagnostics,
			dryRun: options.dryRun ?? false,
			operation: 'atomic_json_write',
			success: false,
			targetPath: normalizedTarget,
		};
	}
	const jsonContent = serialized.json as string;

	// 3. Check if target exists (and is a directory)
	const { stat } = await import('node:fs/promises');
	let targetExists = false;
	try {
		const s = await stat(normalizedTarget);
		if (s.isDirectory()) {
			diagnostics.push({
				code: 'directory_target_rejected',
				message: `Target path is an existing directory; file write requires a file path.`,
				operation: 'atomic_json_write',
				recoveryHint: 'Provide a file path, not a directory.',
				severity: 'error',
				targetPath: normalizedTarget,
			});
			return {
				changedPaths,
				diagnostics,
				dryRun: options.dryRun ?? false,
				operation: 'atomic_json_write',
				success: false,
				targetPath: normalizedTarget,
			};
		}
		targetExists = s.isFile();
	} catch {
		targetExists = false;
	}

	// 4. Policy check
	const policy: SafeWritePolicy = options.policy ?? 'fail_if_exists';
	const policyResult = resolveWritePolicy(
		policy,
		normalizedTarget,
		targetExists,
	);
	diagnostics.push(
		...policyResult.diagnostics.map((d) => ({
			...d,
			...({ operation: 'atomic_json_write' } as Partial<SafeWriteDiagnostic>),
		})),
	);

	if (!policyResult.allowed) {
		return {
			changedPaths,
			diagnostics,
			dryRun: options.dryRun ?? false,
			operation: 'atomic_json_write',
			success: false,
			targetPath: normalizedTarget,
		};
	}

	// 5. Dry-run: return plan without mutations
	if (options.dryRun) {
		const wouldCreateDirs: string[] = [];
		if (
			policyResult.action === 'write' ||
			policyResult.action === 'backup_then_write'
		) {
			const dirsToCreate = await computeMissingDirectories(targetDir);
			for (const d of dirsToCreate) {
				wouldCreateDirs.push(d);
				changedPaths.push({ path: d, role: 'planned' });
			}
		}

		if (policyResult.action === 'skip') {
			changedPaths.push({ path: normalizedTarget, role: 'planned' });
			return {
				changedPaths,
				diagnostics,
				dryRun: true,
				operation: 'atomic_json_write',
				success: true,
				targetPath: normalizedTarget,
			};
		}

		if (policyResult.action === 'backup_then_write') {
			const backupDir = options.backupDir ?? targetDir;
			const base = basename(normalizedTarget);
			const ts = options._testTimestamp ?? '2024-01-01T00-00-00-000Z';
			const backupName = `${ts}-${base}.bak`;
			const backupPath = join(backupDir, backupName);
			changedPaths.push({ path: backupPath, role: 'planned' });
		}

		changedPaths.push({ path: normalizedTarget, role: 'planned' });
		return {
			changedPaths,
			diagnostics,
			dryRun: true,
			operation: 'atomic_json_write',
			success: true,
			targetPath: normalizedTarget,
		};
	}

	// 6. Execute: create parent directories
	if (
		policyResult.action === 'write' ||
		policyResult.action === 'backup_then_write'
	) {
		const dirsToCreate = await computeMissingDirectories(targetDir);
		try {
			await fs.mkdir(targetDir, { recursive: true });
		} catch (err: unknown) {
			diagnostics.push({
				cause: err,
				code: 'mkdir_failed',
				message: `Failed to create parent directory: ${String(err)}`,
				operation: 'atomic_json_write',
				recoveryHint: 'Check filesystem permissions and disk space.',
				severity: 'error',
				targetPath: normalizedTarget,
			});
			return {
				changedPaths,
				diagnostics,
				dryRun: false,
				operation: 'atomic_json_write',
				success: false,
				targetPath: normalizedTarget,
			};
		}

		for (const d of dirsToCreate) {
			changedPaths.push({ path: d, role: 'directory_created' });
		}
	}

	// 7. Skip path
	if (policyResult.action === 'skip') {
		changedPaths.push({ path: normalizedTarget, role: 'skipped' });
		return {
			backupPath: undefined,
			changedPaths,
			diagnostics,
			dryRun: false,
			operation: 'atomic_json_write',
			success: true,
			targetPath: normalizedTarget,
		};
	}

	// 8. Create backup if needed
	let backupPath: string | undefined;
	if (policyResult.action === 'backup_then_write') {
		const backupDir = options.backupDir ?? targetDir;
		try {
			const backupResult = await createBackup(
				normalizedTarget,
				{
					backupDir,
					deterministicTimestamp: options._testTimestamp ?? undefined,
				},
				fs,
			);
			if (backupResult.status === 'created') {
				backupPath = backupResult.backupPath;
				changedPaths.push({
					path: backupResult.backupPath,
					role: 'backup_created',
				});
			} else {
				diagnostics.push({
					backupPath: undefined,
					code: 'backup_failed',
					message: `Failed to create backup before overwriting target.`,
					operation: 'atomic_json_write',
					recoveryHint:
						'Check filesystem permissions and disk space for backup directory.',
					severity: 'error',
					targetPath: normalizedTarget,
				});
				return {
					backupPath: undefined,
					changedPaths,
					diagnostics,
					dryRun: false,
					operation: 'atomic_json_write',
					success: false,
					targetPath: normalizedTarget,
				};
			}
		} catch (err: unknown) {
			diagnostics.push({
				backupPath: undefined,
				cause: err,
				code: 'backup_failed',
				message: `Backup creation threw an error: ${String(err)}`,
				operation: 'atomic_json_write',
				recoveryHint:
					'The original file is untouched. Check filesystem permissions.',
				severity: 'error',
				targetPath: normalizedTarget,
			});
			return {
				backupPath: undefined,
				changedPaths,
				diagnostics,
				dryRun: false,
				operation: 'atomic_json_write',
				success: false,
				targetPath: normalizedTarget,
			};
		}
	}

	// 9. Atomic write via temp file
	const randomId =
		options._testRandomId ?? randomUUID().replace(/-/g, '').slice(0, 12);
	const tempPath = join(
		targetDir,
		`.${basename(normalizedTarget)}.${randomId}.tmp`,
	);

	try {
		await fs.writeFile(tempPath, jsonContent);
	} catch (err: unknown) {
		// Preserve existing target; temp write failed
		const tempCleanupErr = await tryCleanupTemp(fs, tempPath);
		diagnostics.push({
			cause: err,
			code: 'temp_write_failed',
			message: `Failed to write temporary file: ${String(err)}`,
			operation: 'atomic_json_write',
			recoveryHint: tempCleanupErr
				? undefined
				: 'The target file is untouched.',
			severity: 'error',
			targetPath: normalizedTarget,
		});
		if (tempCleanupErr) {
			diagnostics.push(tempCleanupErr);
		}
		return {
			backupPath,
			changedPaths,
			diagnostics,
			dryRun: false,
			operation: 'atomic_json_write',
			success: false,
			targetPath: normalizedTarget,
		};
	}

	try {
		await fs.rename(tempPath, normalizedTarget);
	} catch (err: unknown) {
		// Rename failed; try to clean up temp, but target should be untouched
		const tempCleanupErr = await tryCleanupTemp(fs, tempPath);
		diagnostics.push({
			cause: err,
			code: 'rename_failed',
			message: `Atomic rename failed: ${String(err)}`,
			operation: 'atomic_json_write',
			recoveryHint: 'The target file may be untouched. A temp file may remain.',
			severity: 'error',
			targetPath: normalizedTarget,
		});
		if (tempCleanupErr) {
			diagnostics.push(tempCleanupErr);
		}
		return {
			backupPath,
			changedPaths,
			diagnostics,
			dryRun: false,
			operation: 'atomic_json_write',
			success: false,
			targetPath: normalizedTarget,
		};
	}

	changedPaths.push({
		path: normalizedTarget,
		role: targetExists ? 'file_updated' : 'file_created',
	});

	return {
		backupPath,
		changedPaths,
		diagnostics,
		dryRun: false,
		operation: 'atomic_json_write',
		success: true,
		targetPath: normalizedTarget,
	};
}

// ---------------------------------------------------------------------------
// Atomic Text Write (generic)
// ---------------------------------------------------------------------------

export async function writeFileAtomic(
	targetPath: string,
	content: string,
	options: AtomicJsonWriteOptions = {},
): Promise<SafeWriteResult> {
	const fs = options._fs ?? nodeFsAdapter;
	const targetDir = dirname(normalize(targetPath));
	const normalizedTarget = normalize(targetPath);
	const changedPaths: SafeWriteChangedPath[] = [];
	const diagnostics: SafeWriteDiagnostic[] = [];

	const pathSafety = checkPathSafety(normalizedTarget, {
		allowedBaseDir: options.allowedBaseDir,
	});
	diagnostics.push(...pathSafety.diagnostics);
	if (!pathSafety.safe) {
		return {
			changedPaths,
			diagnostics,
			dryRun: options.dryRun ?? false,
			operation: 'atomic_text_write',
			success: false,
			targetPath: normalizedTarget,
		};
	}

	const { stat } = await import('node:fs/promises');
	let targetExists = false;
	try {
		const s = await stat(normalizedTarget);
		if (s.isDirectory()) {
			diagnostics.push({
				code: 'directory_target_rejected',
				message: `Target path is an existing directory; file write requires a file path.`,
				operation: 'atomic_text_write',
				recoveryHint: 'Provide a file path, not a directory.',
				severity: 'error',
				targetPath: normalizedTarget,
			});
			return {
				changedPaths,
				diagnostics,
				dryRun: options.dryRun ?? false,
				operation: 'atomic_text_write',
				success: false,
				targetPath: normalizedTarget,
			};
		}
		targetExists = s.isFile();
	} catch {
		targetExists = false;
	}

	const policy: SafeWritePolicy = options.policy ?? 'fail_if_exists';
	const policyResult = resolveWritePolicy(
		policy,
		normalizedTarget,
		targetExists,
	);
	diagnostics.push(...policyResult.diagnostics);

	if (!policyResult.allowed) {
		return {
			changedPaths,
			diagnostics,
			dryRun: options.dryRun ?? false,
			operation: 'atomic_text_write',
			success: false,
			targetPath: normalizedTarget,
		};
	}

	if (options.dryRun) {
		if (policyResult.action === 'skip') {
			changedPaths.push({ path: normalizedTarget, role: 'planned' });
		} else {
			const dirsToCreate = await computeMissingDirectories(targetDir);
			for (const d of dirsToCreate) {
				changedPaths.push({ path: d, role: 'planned' });
			}
			if (policyResult.action === 'backup_then_write') {
				const backupDir = options.backupDir ?? targetDir;
				const base = basename(normalizedTarget);
				const ts = options._testTimestamp ?? '2024-01-01T00-00-00-000Z';
				const backupName = `${ts}-${base}.bak`;
				changedPaths.push({
					path: join(backupDir, backupName),
					role: 'planned',
				});
			}
			changedPaths.push({ path: normalizedTarget, role: 'planned' });
		}
		return {
			changedPaths,
			diagnostics,
			dryRun: true,
			operation: 'atomic_text_write',
			success: true,
			targetPath: normalizedTarget,
		};
	}

	if (policyResult.action === 'skip') {
		changedPaths.push({ path: normalizedTarget, role: 'skipped' });
		return {
			changedPaths,
			diagnostics,
			dryRun: false,
			operation: 'atomic_text_write',
			success: true,
			targetPath: normalizedTarget,
		};
	}

	if (
		policyResult.action === 'write' ||
		policyResult.action === 'backup_then_write'
	) {
		const dirsToCreate = await computeMissingDirectories(targetDir);
		try {
			await fs.mkdir(targetDir, { recursive: true });
		} catch (err: unknown) {
			diagnostics.push({
				cause: err,
				code: 'mkdir_failed',
				message: `Failed to create parent directory: ${String(err)}`,
				operation: 'atomic_text_write',
				recoveryHint: 'Check filesystem permissions and disk space.',
				severity: 'error',
				targetPath: normalizedTarget,
			});
			return {
				changedPaths,
				diagnostics,
				dryRun: false,
				operation: 'atomic_text_write',
				success: false,
				targetPath: normalizedTarget,
			};
		}

		for (const d of dirsToCreate) {
			changedPaths.push({ path: d, role: 'directory_created' });
		}
	}

	let backupPath: string | undefined;
	if (policyResult.action === 'backup_then_write') {
		const backupDir = options.backupDir ?? targetDir;
		try {
			const backupResult = await createBackup(
				normalizedTarget,
				{
					backupDir,
					deterministicTimestamp: options._testTimestamp ?? undefined,
				},
				fs,
			);
			if (backupResult.status === 'created') {
				backupPath = backupResult.backupPath;
				changedPaths.push({
					path: backupResult.backupPath,
					role: 'backup_created',
				});
			} else {
				diagnostics.push({
					code: 'backup_failed',
					message: `Failed to create backup before overwriting target.`,
					operation: 'atomic_text_write',
					recoveryHint: 'Check filesystem permissions.',
					severity: 'error',
					targetPath: normalizedTarget,
				});
				return {
					backupPath: undefined,
					changedPaths,
					diagnostics,
					dryRun: false,
					operation: 'atomic_text_write',
					success: false,
					targetPath: normalizedTarget,
				};
			}
		} catch (err: unknown) {
			diagnostics.push({
				cause: err,
				code: 'backup_failed',
				message: `Backup creation threw an error: ${String(err)}`,
				operation: 'atomic_text_write',
				recoveryHint: 'The original file is untouched.',
				severity: 'error',
				targetPath: normalizedTarget,
			});
			return {
				backupPath: undefined,
				changedPaths,
				diagnostics,
				dryRun: false,
				operation: 'atomic_text_write',
				success: false,
				targetPath: normalizedTarget,
			};
		}
	}

	const randomId =
		options._testRandomId ?? randomUUID().replace(/-/g, '').slice(0, 12);
	const tempPath = join(
		targetDir,
		`.${basename(normalizedTarget)}.${randomId}.tmp`,
	);

	try {
		await fs.writeFile(tempPath, content);
	} catch (err: unknown) {
		const tempCleanupErr = await tryCleanupTemp(fs, tempPath);
		diagnostics.push({
			cause: err,
			code: 'temp_write_failed',
			message: `Failed to write temporary file: ${String(err)}`,
			operation: 'atomic_text_write',
			recoveryHint: 'The target file is untouched.',
			severity: 'error',
			targetPath: normalizedTarget,
		});
		if (tempCleanupErr) {
			diagnostics.push(tempCleanupErr);
		}
		return {
			backupPath,
			changedPaths,
			diagnostics,
			dryRun: false,
			operation: 'atomic_text_write',
			success: false,
			targetPath: normalizedTarget,
		};
	}

	try {
		await fs.rename(tempPath, normalizedTarget);
	} catch (err: unknown) {
		const tempCleanupErr = await tryCleanupTemp(fs, tempPath);
		diagnostics.push({
			cause: err,
			code: 'rename_failed',
			message: `Atomic rename failed: ${String(err)}`,
			operation: 'atomic_text_write',
			recoveryHint: 'A temp file may remain.',
			severity: 'error',
			targetPath: normalizedTarget,
		});
		if (tempCleanupErr) {
			diagnostics.push(tempCleanupErr);
		}
		return {
			backupPath,
			changedPaths,
			diagnostics,
			dryRun: false,
			operation: 'atomic_text_write',
			success: false,
			targetPath: normalizedTarget,
		};
	}

	changedPaths.push({
		path: normalizedTarget,
		role: targetExists ? 'file_updated' : 'file_created',
	});

	return {
		backupPath,
		changedPaths,
		diagnostics,
		dryRun: false,
		operation: 'atomic_text_write',
		success: true,
		targetPath: normalizedTarget,
	};
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function computeMissingDirectories(targetDir: string): Promise<string[]> {
	const { stat } = await import('node:fs/promises');
	const parts: string[] = [];
	const normalized = normalize(targetDir);
	let current = normalized;
	const root = resolve('/');

	while (current !== root && current !== resolve('.')) {
		parts.push(current);
		const parent = dirname(current);
		if (parent === current) break;
		current = parent;
	}

	parts.reverse();

	const missing: string[] = [];
	for (const dir of parts) {
		try {
			const dirStat = await stat(dir);
			if (!dirStat.isDirectory()) {
				missing.push(dir);
			}
		} catch {
			missing.push(dir);
		}
	}
	return missing;
}

async function tryCleanupTemp(
	_fs: SafeFsAdapter,
	tempPath: string,
): Promise<SafeWriteDiagnostic | undefined> {
	const { rm } = await import('node:fs/promises');
	try {
		await rm(tempPath, { force: true });
	} catch {
		return {
			code: 'temp_cleanup_failed',
			message: `Could not clean up temp file: ${tempPath}`,
			operation: 'temp_cleanup',
			recoveryHint: 'Manually remove the temp file when safe.',
			severity: 'warning',
			targetPath: tempPath,
		};
	}
	return undefined;
}
