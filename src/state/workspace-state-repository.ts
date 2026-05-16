/** Workspace State Repository — safe read, validate, and update of `.logos/workspace.json` */

import { readFile } from 'node:fs/promises';
import { join, normalize } from 'node:path';
import { type SafeFsAdapter, writeJsonAtomic } from '../fs/safe-filesystem.js';
import {
	WORKSPACE_STATE_SCHEMA_VERSION,
	type WorkspaceState,
} from './workspace-state.schema.js';
import { validateWorkspaceState } from './workspace-state-validation.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WorkspaceStateReadOptions {
	projectRoot: string;
	_fs?: SafeFsAdapter | undefined;
}

export interface WorkspaceStateWriteOptions {
	projectRoot: string;
	state: WorkspaceState;
	policy?: 'overwrite' | 'backup_and_overwrite' | 'create_only';
	dryRun?: boolean | undefined;
	_fs?: SafeFsAdapter | undefined;
	_testTimestamp?: string | undefined;
	_testRandomId?: string | undefined;
}

export interface WorkspaceStateUpdateOptions {
	projectRoot: string;
	updater: (state: WorkspaceState) => WorkspaceState;
	policy?: 'overwrite' | 'backup_and_overwrite';
	dryRun?: boolean | undefined;
	clock?: Clock;
	_fs?: SafeFsAdapter | undefined;
	_testTimestamp?: string | undefined;
	_testRandomId?: string | undefined;
}

export interface Clock {
	now(): string;
}

const defaultClock: Clock = {
	now: () => new Date().toISOString(),
};

export interface WorkspaceStateReadResult {
	success: boolean;
	state: WorkspaceState | undefined;
	diagnostics: WorkspaceStateRepositoryDiagnostic[];
	initializationState: 'initialized' | 'missing' | 'partial' | 'invalid';
	workspaceFilePath: string;
}

export interface WorkspaceStateWriteResult {
	success: boolean;
	state: WorkspaceState;
	changedPaths: string[];
	diagnostics: WorkspaceStateRepositoryDiagnostic[];
	dryRun: boolean;
}

export interface WorkspaceStateUpdateResult {
	success: boolean;
	state: WorkspaceState;
	changedPaths: string[];
	diagnostics: WorkspaceStateRepositoryDiagnostic[];
	dryRun: boolean;
}

export interface WorkspaceStateRepositoryDiagnostic {
	code: string;
	message: string;
	severity: 'error' | 'warning';
	path?: string | undefined;
	recoveryHint?: string | undefined;
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

const WORKSPACE_STATE_FILENAME = 'workspace.json';
const LOGOS_DIR_NAME = '.logos';

export async function readWorkspaceState(
	options: WorkspaceStateReadOptions,
): Promise<WorkspaceStateReadResult> {
	const projectRoot = normalize(options.projectRoot);
	const workspaceFilePath = join(
		projectRoot,
		LOGOS_DIR_NAME,
		WORKSPACE_STATE_FILENAME,
	);
	const diagnostics: WorkspaceStateRepositoryDiagnostic[] = [];

	let rawText: string;
	try {
		rawText = await readFile(workspaceFilePath, 'utf-8');
	} catch (err: unknown) {
		const code = (err as NodeJS.ErrnoException).code;
		if (code === 'ENOENT') {
			diagnostics.push({
				code: 'workspace_missing',
				message: `Workspace state file not found at ${workspaceFilePath}`,
				recoveryHint: 'Run /init to initialize the workspace.',
				severity: 'error',
			});
			return {
				diagnostics,
				initializationState: 'missing',
				state: undefined,
				success: false,
				workspaceFilePath,
			};
		}

		diagnostics.push({
			code: 'workspace_read_failed',
			message: `Failed to read workspace state: ${String(err)}`,
			recoveryHint: 'Check file permissions and try again.',
			severity: 'error',
		});
		return {
			diagnostics,
			initializationState: 'invalid',
			state: undefined,
			success: false,
			workspaceFilePath,
		};
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(rawText) as unknown;
	} catch (err: unknown) {
		diagnostics.push({
			code: 'workspace_json_invalid',
			message: `Workspace state file is not valid JSON: ${String(err)}`,
			path: workspaceFilePath,
			recoveryHint:
				'Review or remove the invalid state file, then run /init to recreate it.',
			severity: 'error',
		});
		return {
			diagnostics,
			initializationState: 'invalid',
			state: undefined,
			success: false,
			workspaceFilePath,
		};
	}

	const validation = validateWorkspaceState(parsed);
	if (!validation.success) {
		for (const err of validation.errors) {
			diagnostics.push({
				code: `state_validation_${err.code}`,
				message: err.message,
				path: err.path,
				recoveryHint: err.recoveryHint,
				severity: err.severity,
			});
		}
		return {
			diagnostics,
			initializationState: 'invalid',
			state: undefined,
			success: false,
			workspaceFilePath,
		};
	}

	return {
		diagnostics,
		initializationState: 'initialized',
		state: validation.state,
		success: true,
		workspaceFilePath,
	};
}

export async function requireWorkspaceState(
	options: WorkspaceStateReadOptions,
): Promise<WorkspaceState> {
	const result = await readWorkspaceState(options);
	if (!result.success || !result.state) {
		const messages = result.diagnostics.map((d) => d.message).join('; ');
		throw new Error(`Workspace state is not available: ${messages}`);
	}
	return result.state;
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

export async function writeWorkspaceState(
	options: WorkspaceStateWriteOptions,
): Promise<WorkspaceStateWriteResult> {
	const projectRoot = normalize(options.projectRoot);
	const workspaceFilePath = join(
		projectRoot,
		LOGOS_DIR_NAME,
		WORKSPACE_STATE_FILENAME,
	);
	const diagnostics: WorkspaceStateRepositoryDiagnostic[] = [];

	// Validate before writing
	const validation = validateWorkspaceState(options.state);
	if (!validation.success) {
		for (const err of validation.errors) {
			diagnostics.push({
				code: `state_validation_${err.code}`,
				message: err.message,
				path: err.path,
				recoveryHint: err.recoveryHint,
				severity: err.severity,
			});
		}
		return {
			changedPaths: [],
			diagnostics,
			dryRun: options.dryRun ?? false,
			state: options.state,
			success: false,
		};
	}

	const writeResult = await writeJsonAtomic(workspaceFilePath, options.state, {
		_fs: options._fs,
		_testRandomId: options._testRandomId,
		_testTimestamp: options._testTimestamp,
		allowedBaseDir: projectRoot,
		dryRun: options.dryRun,
		policy: options.policy ?? 'overwrite',
	});

	const changedPaths = writeResult.changedPaths.map((cp) => cp.path);

	for (const diag of writeResult.diagnostics) {
		diagnostics.push({
			code: diag.code,
			message: diag.message,
			path: diag.targetPath ?? diag.backupPath,
			recoveryHint: diag.recoveryHint,
			severity: diag.severity,
		});
	}

	return {
		changedPaths,
		diagnostics,
		dryRun: writeResult.dryRun,
		state: options.state,
		success: writeResult.success,
	};
}

// ---------------------------------------------------------------------------
// Update (read + validate + apply + validate + write)
// ---------------------------------------------------------------------------

export async function updateWorkspaceState(
	options: WorkspaceStateUpdateOptions,
): Promise<WorkspaceStateUpdateResult> {
	const projectRoot = normalize(options.projectRoot);
	const clock = options.clock ?? defaultClock;

	// 1. Read current state
	const readResult = await readWorkspaceState({
		_fs: options._fs,
		projectRoot,
	});

	if (!readResult.success || !readResult.state) {
		return {
			changedPaths: [],
			diagnostics: readResult.diagnostics,
			dryRun: options.dryRun ?? false,
			state: readResult.state ?? createEmptyState(projectRoot),
			success: false,
		};
	}

	// 2. Apply updater
	const nextState = options.updater(structuredClone(readResult.state));

	// 3. Update metadata timestamp
	nextState.workspace.updatedAt = clock.now();

	// 4. Validate next state
	const validation = validateWorkspaceState(nextState);
	if (!validation.success) {
		const diagnostics: WorkspaceStateRepositoryDiagnostic[] = [
			...readResult.diagnostics,
		];
		for (const err of validation.errors) {
			diagnostics.push({
				code: `state_validation_${err.code}`,
				message: err.message,
				path: err.path,
				recoveryHint: err.recoveryHint,
				severity: err.severity,
			});
		}
		return {
			changedPaths: [],
			diagnostics,
			dryRun: options.dryRun ?? false,
			state: nextState,
			success: false,
		};
	}

	// 5. Write via safe adapter
	const writeResult = await writeWorkspaceState({
		_fs: options._fs,
		_testRandomId: options._testRandomId,
		_testTimestamp: options._testTimestamp,
		dryRun: options.dryRun,
		policy: options.policy ?? 'overwrite',
		projectRoot,
		state: nextState,
	});

	return {
		changedPaths: writeResult.changedPaths,
		diagnostics: [...readResult.diagnostics, ...writeResult.diagnostics],
		dryRun: writeResult.dryRun,
		state: nextState,
		success: writeResult.success,
	};
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createEmptyState(projectRoot: string): WorkspaceState {
	return {
		artifacts: [],
		assumptions: [],
		auditEvents: [],
		decisions: [],
		documentation: {
			isDefault: true,
			rootPath: 'logos/',
			wasExplicitlyConfigured: false,
		},
		generationRuns: [],
		migrations: [],
		openQuestions: [],
		profile: { profileId: 'standard', source: 'bundled' },
		proposals: [],
		risks: [],
		runs: [],
		schemaVersion: WORKSPACE_STATE_SCHEMA_VERSION,
		sessions: [],
		validationRuns: [],
		workspace: {
			createdAt: new Date().toISOString(),
			initializationState: 'uninitialized',
			projectRootPath: projectRoot,
			updatedAt: new Date().toISOString(),
			workspaceId: 'unknown',
		},
	};
}
