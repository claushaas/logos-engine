/**
 * Centralized diagnostic, error code, recovery hint, and safe formatting model.
 *
 * Step 13.1 — Harden Error and Recovery Model
 *
 * All user-facing diagnostics must use stable codes, severities, optional
 * source pointers, recovery hints, and safe redaction. Unknown exceptions
 * must be wrapped rather than leaked.
 */

// ---------------------------------------------------------------------------
// Stable Error Code Convention
// ---------------------------------------------------------------------------

/**
 * Stable, namespaced diagnostic/error code.
 *
 * Format: `LOGOS_<AREA>_<REASON>`
 *
 * Areas represent the subsystem that produced the diagnostic.
 */
export type LogosDiagnosticCode = string;

/** Well-known diagnostic areas */
export const DIAGNOSTIC_AREAS = [
	'CLI',
	'TUI',
	'PROFILE',
	'STATE',
	'FS',
	'GENERATION',
	'VALIDATION',
	'GRAPH',
	'PROVENANCE',
	'HTML',
	'AGENT_PACK',
	'EXECUTIVE',
	'IMPORT',
	'SCANNER',
	'CONSISTENCY',
	'EXTRACTION',
	'SECURITY',
	'UNKNOWN',
] as const;

export type DiagnosticArea = (typeof DIAGNOSTIC_AREAS)[number];

/**
 * Build a stable diagnostic code from an area and local reason.
 * Codes that already match the convention pass through unchanged.
 */
export function diagnosticCode(
	area: DiagnosticArea,
	reason: string,
): LogosDiagnosticCode {
	return `LOGOS_${area}_${reason}`;
}

// ---------------------------------------------------------------------------
// Severity
// ---------------------------------------------------------------------------

export type LogosDiagnosticSeverity = 'info' | 'warning' | 'error' | 'fatal';

export const DIAGNOSTIC_SEVERITY_ORDER: Record<
	LogosDiagnosticSeverity,
	number
> = {
	error: 1,
	fatal: 0,
	info: 3,
	warning: 2,
};

/**
 * Compare two severities deterministically (lower index = more severe / higher priority).
 */
export function compareSeverity(
	a: LogosDiagnosticSeverity,
	b: LogosDiagnosticSeverity,
): number {
	return DIAGNOSTIC_SEVERITY_ORDER[a] - DIAGNOSTIC_SEVERITY_ORDER[b];
}

// ---------------------------------------------------------------------------
// Recovery Hint
// ---------------------------------------------------------------------------

export type LogosRecoveryHintCategory =
	| 'run_command'
	| 'rerun_with_dry_run'
	| 'check_path'
	| 'fix_config'
	| 'restore_backup'
	| 'resolve_collision'
	| 'resolve_validation_finding'
	| 'resolve_open_question'
	| 'regenerate_canonical_docs'
	| 'review_import_candidate'
	| 'review_extracted_candidate'
	| 'configure_provider'
	| 'remove_secret'
	| 'manual_review'
	| 'report_bug';

export const RECOVERY_HINT_CATEGORIES: readonly LogosRecoveryHintCategory[] = [
	'run_command',
	'rerun_with_dry_run',
	'check_path',
	'fix_config',
	'restore_backup',
	'resolve_collision',
	'resolve_validation_finding',
	'resolve_open_question',
	'regenerate_canonical_docs',
	'review_import_candidate',
	'review_extracted_candidate',
	'configure_provider',
	'remove_secret',
	'manual_review',
	'report_bug',
];

/**
 * Structured recovery hint.
 *
 * Every diagnostic should include at least one recovery hint when
 * the user needs to take specific action to recover.
 */
export interface LogosRecoveryHint {
	/** Actionable category */
	category: LogosRecoveryHintCategory;
	/** Human-readable text explaining the recovery action */
	message: string;
	/** Command to run (when category is run_command or rerun_with_dry_run) */
	command?: string | undefined;
	/** Path that needs inspection (when category is check_path) */
	path?: string | undefined;
	/** Configuration key or section to fix (when category is fix_config) */
	configKey?: string | undefined;
	/** Related entity identifiers for context */
	relatedIds?: LogosDiagnosticRelatedIds | undefined;
}

// ---------------------------------------------------------------------------
// Related Entity IDs
// ---------------------------------------------------------------------------

export interface LogosDiagnosticRelatedIds {
	profileId?: string | undefined;
	phaseId?: string | undefined;
	documentId?: string | undefined;
	artifactId?: string | undefined;
	runId?: string | undefined;
	commandName?: string | undefined;
	candidateId?: string | undefined;
	findingId?: string | undefined;
	registerItemId?: string | undefined;
	executivePlanId?: string | undefined;
	sessionId?: string | undefined;
}

// ---------------------------------------------------------------------------
// Diagnostic
// ---------------------------------------------------------------------------

/**
 * User-facing diagnostic shape.
 *
 * Every diagnostic must:
 * - Have a stable code
 * - Have a severity
 * - Have a human-readable message
 * - Optionally reference source location, pointer, related ids
 * - Include recovery hints when user action is needed
 * - Never expose raw secrets, prompts, model responses, or stack traces
 */
export interface LogosDiagnostic {
	/** Stable namespaced code */
	code: LogosDiagnosticCode;
	/** Severity */
	severity: LogosDiagnosticSeverity;
	/** Human-readable message (must not contain raw secrets) */
	message: string;
	/** Source file/directory path (relative/portable by convention) */
	path?: string | undefined;
	/** Field/property pointer within the source */
	pointer?: string | undefined;
	/** Recovery hints for the user */
	recoveryHints: LogosRecoveryHint[];
	/** Related entity identifiers */
	relatedIds?: LogosDiagnosticRelatedIds | undefined;
	/** Expected value when validation failed */
	expectedValue?: string | undefined;
	/** Received value when validation failed */
	receivedValue?: string | undefined;
	/** Documentation reference URL or path */
	documentationRef?: string | undefined;
	/** Summary of any redaction applied */
	redactionSummary?: string | undefined;
	/** Internal cause — not exposed in user-facing output */
	cause?: unknown;
}

/**
 * Create a deterministic diagnostic.
 */
export interface LogosDiagnosticInput {
	code: LogosDiagnosticCode;
	severity: LogosDiagnosticSeverity;
	message: string;
	path?: string | undefined;
	pointer?: string | undefined;
	recoveryHints?: LogosRecoveryHint[] | undefined;
	relatedIds?: LogosDiagnosticRelatedIds | undefined;
	expectedValue?: string | undefined;
	receivedValue?: string | undefined;
	documentationRef?: string | undefined;
	redactionSummary?: string | undefined;
	cause?: unknown;
}

export function createDiagnostic(input: LogosDiagnosticInput): LogosDiagnostic {
	return {
		cause: input.cause,
		code: input.code,
		documentationRef: input.documentationRef,
		expectedValue: input.expectedValue,
		message: input.message,
		path: input.path,
		pointer: input.pointer,
		receivedValue: input.receivedValue,
		recoveryHints: input.recoveryHints ?? [],
		redactionSummary: input.redactionSummary,
		relatedIds: input.relatedIds,
		severity: input.severity,
	};
}

/**
 * Create a recovery hint with a simple message and category.
 */
export function recoveryHint(
	category: LogosRecoveryHintCategory,
	message: string,
	options?: {
		command?: string | undefined;
		path?: string | undefined;
		configKey?: string | undefined;
		relatedIds?: LogosDiagnosticRelatedIds | undefined;
	},
): LogosRecoveryHint {
	return {
		category,
		command: options?.command,
		configKey: options?.configKey,
		message,
		path: options?.path,
		relatedIds: options?.relatedIds,
	};
}

// ---------------------------------------------------------------------------
// Shortcut recovery hint factories
// ---------------------------------------------------------------------------

export const RecoveryHints = {
	checkPath: (message: string, path: string) =>
		recoveryHint('check_path', message, { path }),

	configureProvider: (message: string) =>
		recoveryHint('configure_provider', message),

	fixConfig: (message: string, configKey: string) =>
		recoveryHint('fix_config', message, { configKey }),

	manualReview: (message: string) => recoveryHint('manual_review', message),

	regenerateDocs: (message: string) =>
		recoveryHint('regenerate_canonical_docs', message),

	removeSecret: (message: string) => recoveryHint('remove_secret', message),

	reportBug: (message: string) => recoveryHint('report_bug', message),

	rerunWithDryRun: (message: string, command: string) =>
		recoveryHint('rerun_with_dry_run', message, { command }),

	resolveCollision: (message: string, path?: string) =>
		recoveryHint('resolve_collision', message, { path }),

	resolveOpenQuestion: (message: string) =>
		recoveryHint('resolve_open_question', message),

	resolveValidationFinding: (message: string) =>
		recoveryHint('resolve_validation_finding', message),

	restoreBackup: (message: string, path?: string) =>
		recoveryHint('restore_backup', message, { path }),

	reviewExtractedCandidate: (message: string) =>
		recoveryHint('review_extracted_candidate', message),

	reviewImportCandidate: (message: string) =>
		recoveryHint('review_import_candidate', message),
	runCommand: (message: string, command: string) =>
		recoveryHint('run_command', message, { command }),
} as const;

// ---------------------------------------------------------------------------
// Operation Status
// ---------------------------------------------------------------------------

export type LogosOperationStatus =
	| 'ok'
	| 'ok_with_warnings'
	| 'blocked'
	| 'failed'
	| 'partial'
	| 'dry_run'
	| 'unknown';

export const OPERATION_STATUS_ORDER: Record<LogosOperationStatus, number> = {
	blocked: 1,
	dry_run: 5,
	failed: 0,
	ok: 4,
	ok_with_warnings: 3,
	partial: 2,
	unknown: 6,
};

// ---------------------------------------------------------------------------
// Operation Phase
// ---------------------------------------------------------------------------

export type LogosOperationPhase =
	| 'planning'
	| 'preflight'
	| 'execution'
	| 'validation'
	| 'cleanup'
	| 'rollback';

// ---------------------------------------------------------------------------
// Changed Path Actions
// ---------------------------------------------------------------------------

export type LogosChangedPathAction =
	| 'created'
	| 'updated'
	| 'skipped'
	| 'backed_up'
	| 'deleted'
	| 'would_create'
	| 'would_update'
	| 'would_skip'
	| 'failed';

export const CHANGED_PATH_ACTION_ORDER: Record<LogosChangedPathAction, number> =
	{
		backed_up: 2,
		created: 0,
		deleted: 3,
		failed: 5,
		skipped: 4,
		updated: 1,
		would_create: 6,
		would_skip: 8,
		would_update: 7,
	};

export interface LogosChangedPath {
	path: string;
	action: LogosChangedPathAction;
	kind?: string | undefined;
	id?: string | undefined;
}

// ---------------------------------------------------------------------------
// Next Action
// ---------------------------------------------------------------------------

export type LogosNextActionCategory =
	| 'run_command'
	| 'review_output'
	| 'accept_proposal'
	| 'resolve_blocker'
	| 'manual_intervention';

export interface LogosNextAction {
	id?: string | undefined;
	severity: LogosDiagnosticSeverity;
	category: LogosNextActionCategory;
	message: string;
	command?: string | undefined;
	path?: string | undefined;
}

// ---------------------------------------------------------------------------
// Partial Failure Reporting
// ---------------------------------------------------------------------------

export interface LogosPartialFailure {
	status: 'partial';
	completedTargets: string[];
	failedTargets: string[];
	skippedTargets: string[];
	backupPaths: string[];
	changedPaths: LogosChangedPath[];
	unchangedPaths: string[];
	recoveryHints: LogosRecoveryHint[];
}

// ---------------------------------------------------------------------------
// Unknown Error Wrapping
// ---------------------------------------------------------------------------

/**
 * Wraps an unknown caught value into a safe LogosDiagnostic.
 *
 * Never exposes raw stack traces, error constructor names, or absolute
 * unredacted paths in user-facing output.
 */
export function wrapUnknownError(
	caught: unknown,
	context?: {
		area?: DiagnosticArea | undefined;
		path?: string | undefined;
		relatedIds?: LogosDiagnosticRelatedIds | undefined;
	},
): LogosDiagnostic {
	const area = context?.area ?? 'UNKNOWN';
	let message = 'An unexpected error occurred.';
	let cause: unknown = caught;

	if (caught instanceof Error) {
		message = caught.message || `Unexpected error: ${caught.name}`;
		cause = caught;
	} else if (typeof caught === 'string') {
		message = caught;
	} else if (caught !== null && caught !== undefined) {
		try {
			message = String(caught);
		} catch {
			message = 'An unexpected error occurred (cannot convert to string).';
		}
	}

	return createDiagnostic({
		cause,
		code: diagnosticCode(area, 'UNEXPECTED_ERROR'),
		message,
		path: context?.path,
		recoveryHints: [
			recoveryHint(
				'report_bug',
				'This error was unexpected. Please report it.',
				{
					relatedIds: context?.relatedIds,
				},
			),
		],
		relatedIds: context?.relatedIds,
		severity: 'fatal',
	});
}

/**
 * Maps 'UNKNOWN' diagnostic code area back to a stable code.
 */
export function UNKNOWN_ERROR_CODE(area?: DiagnosticArea): LogosDiagnosticCode {
	return diagnosticCode(area ?? 'UNKNOWN', 'ERROR');
}

// ---------------------------------------------------------------------------
// Safe Error Formatting
// ---------------------------------------------------------------------------

/**
 * Format a diagnostic for terminal output without exposing raw internals.
 */
export function formatDiagnosticForTerminal(
	diagnostic: LogosDiagnostic,
): string[] {
	const lines: string[] = [];
	const prefix = `[${diagnostic.severity.toUpperCase()}]`;
	lines.push(`${prefix} ${diagnostic.message}`);

	if (diagnostic.code) {
		lines.push(`  Code: ${diagnostic.code}`);
	}
	if (diagnostic.path) {
		lines.push(`  Path: ${diagnostic.path}`);
	}
	if (diagnostic.pointer) {
		lines.push(`  Pointer: ${diagnostic.pointer}`);
	}
	if (diagnostic.expectedValue !== undefined) {
		lines.push(`  Expected: ${diagnostic.expectedValue}`);
	}
	if (diagnostic.receivedValue !== undefined) {
		lines.push(`  Received: ${diagnostic.receivedValue}`);
	}
	if (diagnostic.documentationRef) {
		lines.push(`  Docs: ${diagnostic.documentationRef}`);
	}
	for (const hint of diagnostic.recoveryHints) {
		lines.push(`  Recovery [${hint.category}]: ${hint.message}`);
		if (hint.command) lines.push(`    Run: ${hint.command}`);
		if (hint.path) lines.push(`    Path: ${hint.path}`);
	}
	if (diagnostic.redactionSummary) {
		lines.push(`  Note: ${diagnostic.redactionSummary}`);
	}

	return lines;
}

/**
 * Format multiple diagnostics deterministically for terminal output.
 */
export function formatDiagnosticsForTerminal(
	diagnostics: LogosDiagnostic[],
): string[] {
	const sorted = [...diagnostics].sort(sortDiagnostics);
	const lines: string[] = [];
	for (const d of sorted) {
		for (const line of formatDiagnosticForTerminal(d)) {
			lines.push(line);
		}
	}
	return lines;
}

/**
 * Convert a LogosDiagnostic to a JSON-serializable shape without internal fields.
 */
export function diagnosticToJson(
	diagnostic: LogosDiagnostic,
): Record<string, unknown> {
	const json: Record<string, unknown> = {
		code: diagnostic.code,
		message: diagnostic.message,
		severity: diagnostic.severity,
	};
	if (diagnostic.path) json.path = diagnostic.path;
	if (diagnostic.pointer) json.pointer = diagnostic.pointer;
	if (diagnostic.expectedValue) json.expectedValue = diagnostic.expectedValue;
	if (diagnostic.receivedValue) json.receivedValue = diagnostic.receivedValue;
	if (diagnostic.documentationRef)
		json.documentationRef = diagnostic.documentationRef;
	if (diagnostic.redactionSummary)
		json.redactionSummary = diagnostic.redactionSummary;
	if (diagnostic.relatedIds && Object.keys(diagnostic.relatedIds).length > 0) {
		json.relatedIds = diagnostic.relatedIds;
	}
	if (diagnostic.recoveryHints.length > 0) {
		json.recoveryHints = diagnostic.recoveryHints.map((h) => ({
			category: h.category,
			command: h.command,
			message: h.message,
			path: h.path,
		}));
	}
	return json;
}

// ---------------------------------------------------------------------------
// Deterministic Sorting
// ---------------------------------------------------------------------------

/**
 * Sort diagnostics deterministically:
 * 1. severity (most severe first)
 * 2. code
 * 3. path
 * 4. pointer
 * 5. stable id fallback
 */
export function sortDiagnostics(
	a: LogosDiagnostic,
	b: LogosDiagnostic,
): number {
	const sev = compareSeverity(a.severity, b.severity);
	if (sev !== 0) return sev;

	const codeCmp = a.code.localeCompare(b.code);
	if (codeCmp !== 0) return codeCmp;

	const pathA = a.path ?? '';
	const pathB = b.path ?? '';
	const pathCmp = pathA.localeCompare(pathB);
	if (pathCmp !== 0) return pathCmp;

	const ptrA = a.pointer ?? '';
	const ptrB = b.pointer ?? '';
	return ptrA.localeCompare(ptrB);
}

/**
 * Sort changed paths deterministically:
 * 1. action
 * 2. path
 * 3. kind
 * 4. id
 */
export function sortChangedPaths(
	a: LogosChangedPath,
	b: LogosChangedPath,
): number {
	const actionCmp =
		(CHANGED_PATH_ACTION_ORDER[a.action] ?? 99) -
		(CHANGED_PATH_ACTION_ORDER[b.action] ?? 99);
	if (actionCmp !== 0) return actionCmp;

	const pathCmp = a.path.localeCompare(b.path);
	if (pathCmp !== 0) return pathCmp;

	const kindA = a.kind ?? '';
	const kindB = b.kind ?? '';
	const kindCmp = kindA.localeCompare(kindB);
	if (kindCmp !== 0) return kindCmp;

	const idA = a.id ?? '';
	const idB = b.id ?? '';
	return idA.localeCompare(idB);
}

/**
 * Sort next actions deterministically:
 * 1. severity (most severe first)
 * 2. category
 * 3. command/path
 * 4. id
 */
export function sortNextActions(
	a: LogosNextAction,
	b: LogosNextAction,
): number {
	const sev = compareSeverity(a.severity, b.severity);
	if (sev !== 0) return sev;

	const catCmp = a.category.localeCompare(b.category);
	if (catCmp !== 0) return catCmp;

	const cmdA = a.command ?? a.path ?? '';
	const cmdB = b.command ?? b.path ?? '';
	const cmdCmp = cmdA.localeCompare(cmdB);
	if (cmdCmp !== 0) return cmdCmp;

	const idA = a.id ?? '';
	const idB = b.id ?? '';
	return idA.localeCompare(idB);
}
