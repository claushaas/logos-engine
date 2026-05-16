/** Shared command result envelope — non-mutating runtime conventions */

export type CommandStatus =
	| 'success'
	| 'warning'
	| 'error'
	| 'not_implemented'
	| 'dry_run';

export type CommandExecutionMode = 'normal' | 'dry_run';

export interface CommandMessage {
	level: 'info' | 'success';
	text: string;
}

export interface CommandWarning {
	code: string;
	message: string;
	path?: string;
}

export interface CommandChangedPath {
	path: string;
	action: 'created' | 'modified' | 'deleted' | 'planned';
}

export interface CommandResultMetadata {
	command: string;
	/** ISO 8601 timestamp; may be omitted for deterministic tests */
	timestamp?: string | undefined;
	/** Package version if available */
	version?: string | undefined;
	/** Execution mode */
	mode: CommandExecutionMode;
}

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
	changedPaths: CommandChangedPath[];
	data: unknown;
	metadata: Omit<CommandResultMetadata, 'timestamp'> & {
		timestamp?: string | undefined;
	};
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
		status: options.status ?? 'success',
		warnings: options.warnings ?? [],
	};
}

export function toJsonSerializable<TData>(
	result: CommandResult<TData>,
	redactFn?: (value: unknown) => unknown,
): JsonSerializableCommandResult {
	const data = redactFn ? redactFn(result.data) : result.data;
	return {
		changedPaths: result.changedPaths,
		command: result.metadata.command,
		data,
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
		status: result.status,
		warnings: result.warnings,
	};
}

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

/** Map a CommandStatus to a suggested CLI exit code */
export function statusToExitCode(status: CommandStatus): number {
	switch (status) {
		case 'success':
		case 'dry_run':
			return 0;
		case 'warning':
			return 0;
		case 'error':
		case 'not_implemented':
			return 1;
		default:
			return 1;
	}
}
