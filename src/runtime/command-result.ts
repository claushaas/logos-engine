/** Shared command result envelope — non-mutating runtime conventions */

import type {
	LogosChangedPath,
	LogosChangedPathAction,
	LogosNextAction,
	LogosOperationStatus,
} from './diagnostics.js';

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

/** Legacy status values preserved for backward compatibility */
export type CommandStatus =
	| 'success'
	| 'warning'
	| 'error'
	| 'not_implemented'
	| 'dry_run'
	| 'partial';

export type CommandExecutionMode = 'normal' | 'dry_run';

// ---------------------------------------------------------------------------
// Message / Warning / Error
// ---------------------------------------------------------------------------

export interface CommandMessage {
	level: 'info' | 'success';
	text: string;
}

export interface CommandWarning {
	code: string;
	message: string;
	path?: string;
}

/** Extended changed path with kind/id for partial failure reporting */
export interface CommandChangedPath {
	path: string;
	action:
		| 'created'
		| 'modified'
		| 'deleted'
		| 'planned'
		| LogosChangedPathAction;
	kind?: string | undefined;
	id?: string | undefined;
}

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export interface CommandResultMetadata {
	command: string;
	/** ISO 8601 timestamp; may be omitted for deterministic tests */
	timestamp?: string | undefined;
	/** Package version if available */
	version?: string | undefined;
	/** Execution mode */
	mode: CommandExecutionMode;
}

// ---------------------------------------------------------------------------
// Result Envelope
// ---------------------------------------------------------------------------

export interface CommandResult<TData = unknown> {
	status: CommandStatus;
	messages: CommandMessage[];
	warnings: CommandWarning[];
	errors: CommandError[];
	changedPaths: CommandChangedPath[];
	dryRun: boolean;
	metadata: CommandResultMetadata;
	/** Command-specific structured data */
	data: TData;
	/** Machine-readable next actions suggested by the command */
	nextActions?: LogosNextAction[] | undefined;
}

export interface JsonSerializableCommandResult {
	status: CommandStatus;
	command: string;
	dryRun: boolean;
	messages: string[];
	warnings: Array<{ code: string; message: string; path?: string | undefined }>;
	errors: Array<{
		code: string;
		message: string;
		severity: string;
		path?: string | undefined;
		pointer?: string | undefined;
		recoveryHint?: string | undefined;
	}>;
	changedPaths: Array<{
		path: string;
		action: string;
		kind?: string | undefined;
		id?: string | undefined;
	}>;
	data: unknown;
	metadata: Omit<CommandResultMetadata, 'timestamp'> & {
		timestamp?: string | undefined;
	};
	nextActions?:
		| Array<{
				id?: string | undefined;
				severity: string;
				category: string;
				message: string;
				command?: string | undefined;
				path?: string | undefined;
		  }>
		| undefined;
}

export interface CreateCommandResultOptions<TData = unknown> {
	status?: CommandStatus;
	command: string;
	messages?: CommandMessage[];
	warnings?: CommandWarning[];
	errors?: CommandError[];
	changedPaths?: CommandChangedPath[];
	dryRun?: boolean;
	version?: string | undefined;
	data?: TData;
	/** Set to false to omit timestamp for deterministic tests */
	includeTimestamp?: boolean;
	/** Optional next actions for recovery */
	nextActions?: LogosNextAction[] | undefined;
}

export interface CommandError {
	code: string;
	message: string;
	severity: 'error' | 'warning' | 'fatal';
	path?: string | undefined;
	pointer?: string | undefined;
	recoveryHint?: string | undefined;
	/** Internal only; not exposed in user-facing output */
	cause?: unknown;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createCommandResult<TData = unknown>(
	options: CreateCommandResultOptions<TData>,
): CommandResult<TData> {
	const now =
		options.includeTimestamp !== false ? new Date().toISOString() : undefined;
	return {
		changedPaths: options.changedPaths ?? [],
		data: (options.data ?? undefined) as TData,
		dryRun: options.dryRun ?? false,
		errors: options.errors ?? [],
		messages: options.messages ?? [],
		metadata: {
			command: options.command,
			mode: options.dryRun ? 'dry_run' : 'normal',
			timestamp: now,
			version: options.version,
		},
		nextActions: options.nextActions,
		status: options.status ?? 'success',
		warnings: options.warnings ?? [],
	};
}

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------

export function toJsonSerializable<TData>(
	result: CommandResult<TData>,
	redactFn?: (value: unknown) => unknown,
): JsonSerializableCommandResult {
	const serializable: JsonSerializableCommandResult = {
		changedPaths: result.changedPaths.map((p) => ({
			action: p.action,
			id: p.id,
			kind: p.kind,
			path: p.path,
		})),
		command: result.metadata.command,
		data: result.data,
		dryRun: result.dryRun,
		errors: result.errors.map((e) => ({
			code: e.code,
			message: e.message,
			path: e.path,
			pointer: e.pointer,
			recoveryHint: e.recoveryHint,
			severity: e.severity,
		})),
		messages: result.messages.map((m) => m.text),
		metadata: result.metadata,
		nextActions: result.nextActions?.map((a) => ({
			category: a.category,
			command: a.command,
			id: a.id,
			message: a.message,
			path: a.path,
			severity: a.severity,
		})),
		status: result.status,
		warnings: result.warnings,
	};
	return (
		redactFn ? redactFn(serializable) : serializable
	) as JsonSerializableCommandResult;
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

export function formatCommandResultForHuman<TData>(
	result: CommandResult<TData>,
): string[] {
	const lines: string[] = [];

	for (const msg of result.messages) {
		lines.push(msg.text);
	}

	if (result.warnings.length > 0) {
		for (const w of result.warnings) {
			lines.push(`[WARNING] ${w.message}`);
			if (w.path) {
				lines.push(`  Path: ${w.path}`);
			}
		}
	}

	if (result.errors.length > 0) {
		for (const e of result.errors) {
			lines.push(`[${e.severity.toUpperCase()}] ${e.message}`);
			if (e.path) {
				lines.push(`  Path: ${e.path}`);
			}
			if (e.recoveryHint) {
				lines.push(`  Recovery: ${e.recoveryHint}`);
			}
		}
	}

	if (result.dryRun) {
		lines.push('');
		lines.push('(dry-run: no changes were made)');
	}

	return lines;
}

// ---------------------------------------------------------------------------
// Exit Code Mapping
// ---------------------------------------------------------------------------

/** Map a CommandStatus to a suggested CLI exit code */
export function statusToExitCode(status: CommandStatus): number {
	switch (status) {
		case 'success':
		case 'dry_run':
			return 0;
		case 'warning':
			return 0;
		case 'partial':
			return 0;
		case 'error':
		case 'not_implemented':
			return 1;
		default:
			return 1;
	}
}

// ---------------------------------------------------------------------------
// Operation Status Adapter (Step 13.1)
// ---------------------------------------------------------------------------

/**
 * Convert a LogosOperationStatus to a CommandStatus.
 * Used when services produce operation statuses that need to be
 * represented in command result envelopes.
 */
export function operationStatusToCommandStatus(
	status: LogosOperationStatus,
): CommandStatus {
	switch (status) {
		case 'ok':
			return 'success';
		case 'ok_with_warnings':
			return 'warning';
		case 'blocked':
			return 'error';
		case 'failed':
			return 'error';
		case 'partial':
			return 'partial';
		case 'dry_run':
			return 'dry_run';
		case 'unknown':
			return 'error';
	}
}

/**
 * Build changed paths from LogosChangedPath items.
 */
export function changedPathsFromLogos(
	paths: LogosChangedPath[],
): CommandChangedPath[] {
	return paths.map((p) => ({
		action: p.action,
		id: p.id,
		kind: p.kind,
		path: p.path,
	}));
}
