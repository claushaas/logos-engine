/**
 * Shared TUI confirmation model — types, helpers, diagnostics, and builders.
 *
 * Phase 4: Keyboard Confirmation Framework — Outcome 1 (shared confirmation model).
 *
 * This module defines the shape of interactive confirmation prompts used by
 * the TUI. It does not render UI, mutate state, call providers, or persist
 * anything.
 */

import type { LogosDiagnostic } from '../runtime/diagnostics.js';

// ---------------------------------------------------------------------------
// Action kinds
// ---------------------------------------------------------------------------

export const CONFIRMATION_ACTION_KINDS = [
	'workspace_init',
	'canonical_generation',
	'executive_compile',
	'provider_disclosure',
	'proposal_accept',
	'proposal_revise',
	'proposal_reject',
	'proposal_defer',
	'decision_revise',
	'decision_supersede',
	'write_collision',
	'config_change',
	'unknown',
] as const;

export type ConfirmationActionKind = (typeof CONFIRMATION_ACTION_KINDS)[number];

// ---------------------------------------------------------------------------
// Option kinds
// ---------------------------------------------------------------------------

export const CONFIRMATION_OPTION_KINDS = [
	'confirm',
	'cancel',
	'accept',
	'reject',
	'defer',
	'overwrite',
	'skip',
	'backup_and_write',
	'manual_review',
	'unknown',
] as const;

export type ConfirmationOptionKind = (typeof CONFIRMATION_OPTION_KINDS)[number];

// ---------------------------------------------------------------------------
// Option
// ---------------------------------------------------------------------------

export interface TuiConfirmationOption {
	/** Stable option identifier (deterministic in tests) */
	id: string;

	/** Semantic kind */
	kind: ConfirmationOptionKind;

	/** Human-readable label (e.g. "Accept", "Cancel") */
	label: string;

	/** Optional longer description */
	description?: string | undefined;

	/** What this option will cause */
	consequence?: string | undefined;

	/** Whether this is the default selection */
	isDefault?: boolean | undefined;

	/** Whether this option is destructive */
	isDestructive?: boolean | undefined;
}

// ---------------------------------------------------------------------------
// Target
// ---------------------------------------------------------------------------

export interface TuiConfirmationTarget {
	/** Human-readable kind (e.g. "workspace", "document") */
	kind: string;

	/** Entity id */
	id?: string | undefined;

	/** File path (safe for display) */
	path?: string | undefined;

	/** Safe display string without raw secrets */
	safeDisplay?: string | undefined;
}

// ---------------------------------------------------------------------------
// Request
// ---------------------------------------------------------------------------

export interface TuiConfirmationRequest {
	/** Deterministic request id */
	id: string;

	/** What kind of action is being confirmed */
	actionKind: ConfirmationActionKind;

	/** The slash command that triggered this */
	sourceCommand: string;

	/** Human-readable title */
	title: string;

	/** Explanatory message */
	message: string;

	/** Entity being acted on */
	target?: TuiConfirmationTarget | undefined;

	/** What will happen if confirmed */
	consequences: string[];

	/** Possible alternative paths (informational) */
	alternatives: string[];

	/** Available options */
	options: TuiConfirmationOption[];

	/** Which option is the default */
	defaultOptionId: string;

	/** Currently selected option id */
	selectedOptionId: string;

	/** Whether this is a destructive action */
	destructive: boolean;

	/** Whether this involves sensitive data */
	sensitive: boolean;

	/** ISO 8601 creation timestamp */
	createdAt: string;

	/** Diagnostics attached to the request (preflight issues etc.) */
	diagnostics: LogosDiagnostic[];
}

// ---------------------------------------------------------------------------
// Result
// ---------------------------------------------------------------------------

export type TuiConfirmationOutcome =
	| 'accepted'
	| 'cancelled'
	| 'expired'
	| 'stale'
	| 'invalid_option'
	| 'failed';

export interface TuiConfirmationResult {
	/** Outcome */
	outcome: TuiConfirmationOutcome;

	/** The request id that was resolved */
	confirmationId: string;

	/** The selected option (if accepted) */
	selectedOptionId?: string | undefined;

	/** Human-readable messages for the TUI */
	messages: string[];

	/** Next actions for recovery */
	nextActions: string[];

	/** Diagnostics for error outcomes */
	diagnostics: LogosDiagnostic[];
}

// ---------------------------------------------------------------------------
// Diagnostic codes
// ---------------------------------------------------------------------------

export const CONFIRMATION_DIAGNOSTIC_CODES = {
	/** Confirmation was accepted and action executed */
	CONFIRMATION_ACCEPTED: 'LOGOS_CONFIRMATION_ACCEPTED',

	/** The confirmed action failed during execution */
	CONFIRMATION_ACTION_FAILED: 'LOGOS_CONFIRMATION_ACTION_FAILED',

	/** Confirmation was cancelled by the user */
	CONFIRMATION_CANCELLED: 'LOGOS_CONFIRMATION_CANCELLED',

	/** Confirmation expired before resolution */
	CONFIRMATION_EXPIRED: 'LOGOS_CONFIRMATION_EXPIRED',

	/** Non-interactive context requires --confirm */
	CONFIRMATION_NON_INTERACTIVE_REQUIRED:
		'LOGOS_CONFIRMATION_NON_INTERACTIVE_REQUIRED',

	/** Selected option is not valid */
	CONFIRMATION_OPTION_INVALID: 'LOGOS_CONFIRMATION_OPTION_INVALID',
	/** Confirmation was required but not provided */
	CONFIRMATION_REQUIRED: 'LOGOS_CONFIRMATION_REQUIRED',

	/** Preflight data has become stale */
	CONFIRMATION_STALE_PREFLIGHT: 'LOGOS_CONFIRMATION_STALE_PREFLIGHT',

	/** Confirmation target no longer matches */
	CONFIRMATION_TARGET_MISMATCH: 'LOGOS_CONFIRMATION_TARGET_MISMATCH',

	/** Action kind is not supported for keyboard confirmation */
	CONFIRMATION_UNSUPPORTED_ACTION: 'LOGOS_CONFIRMATION_UNSUPPORTED_ACTION',
} as const;

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

export interface CreateTuiConfirmationRequestOptions {
	actionKind: ConfirmationActionKind;
	sourceCommand: string;
	title: string;
	message: string;
	target?: TuiConfirmationTarget | undefined;
	consequences?: string[] | undefined;
	alternatives?: string[] | undefined;
	options: TuiConfirmationOption[];
	destructive?: boolean | undefined;
	sensitive?: boolean | undefined;
	diagnostics?: LogosDiagnostic[] | undefined;
	/** Deterministic test id override */
	_testId?: string | undefined;
	/** Deterministic test timestamp */
	_testTimestamp?: string | undefined;
}

/**
 * Create a TuiConfirmationRequest with deterministic defaults.
 */
export function createTuiConfirmationRequest(
	input: CreateTuiConfirmationRequestOptions,
): TuiConfirmationRequest {
	const id = createConfirmationId({
		_testId: input._testId,
		actionKind: input.actionKind,
		sourceCommand: input.sourceCommand,
	});
	const defaultOptionId =
		input.options.find((o) => o.isDefault)?.id ?? input.options[0]?.id ?? '';

	return {
		actionKind: input.actionKind,
		alternatives: input.alternatives ?? [],
		consequences: input.consequences ?? [],
		createdAt: input._testTimestamp ?? new Date().toISOString(),
		defaultOptionId,
		destructive: input.destructive ?? false,
		diagnostics: input.diagnostics ?? [],
		id,
		message: input.message,
		options: input.options,
		selectedOptionId: defaultOptionId,
		sensitive: input.sensitive ?? false,
		sourceCommand: input.sourceCommand,
		target: input.target,
		title: input.title,
	};
}

/**
 * Build a deterministic confirmation id.
 */
export function createConfirmationId(options: {
	actionKind: ConfirmationActionKind;
	sourceCommand: string;
	_testId?: string | undefined;
}): string {
	if (options._testId) return `conf-${options._testId}`;
	const ts = Date.now();
	return `conf-${options.actionKind}-${ts}`;
}

/**
 * Create a yes/no accept/cancel option pair.
 */
export function yesNoOptions(options?: {
	acceptLabel?: string | undefined;
	cancelLabel?: string | undefined;
}): TuiConfirmationOption[] {
	return [
		{
			consequence: 'Execute the action.',
			description: 'Proceed with the described operation.',
			id: 'accept',
			isDefault: true,
			isDestructive: false,
			kind: 'accept',
			label: options?.acceptLabel ?? 'Accept',
		},
		{
			consequence: 'Cancel and write nothing.',
			description: 'Abort the operation without making changes.',
			id: 'cancel',
			isDefault: false,
			isDestructive: false,
			kind: 'cancel',
			label: options?.cancelLabel ?? 'Cancel',
		},
	];
}

/**
 * Create extended options for write/collision scenarios.
 */
export function writeCollisionOptions(): TuiConfirmationOption[] {
	return [
		{
			consequence: 'Skip this file and continue.',
			description: 'Do not write this output.',
			id: 'skip',
			isDefault: true,
			isDestructive: false,
			kind: 'skip',
			label: 'Skip',
		},
		{
			consequence: 'Back up the existing file, then write the new one.',
			description: 'Existing content is preserved in a backup.',
			id: 'backup_and_write',
			isDefault: false,
			isDestructive: false,
			kind: 'backup_and_write',
			label: 'Backup + Write',
		},
		{
			consequence: 'Overwrite the existing file. This is destructive.',
			description:
				'The existing file will be replaced. Manual edits will be lost.',
			id: 'overwrite',
			isDefault: false,
			isDestructive: true,
			kind: 'overwrite',
			label: 'Overwrite (destructive)',
		},
		{
			consequence: 'Cancel the entire operation.',
			description: 'No files will be written.',
			id: 'cancel',
			isDefault: false,
			isDestructive: false,
			kind: 'cancel',
			label: 'Cancel',
		},
	];
}

// ---------------------------------------------------------------------------
// Redaction
// ---------------------------------------------------------------------------

/**
 * Redact sensitive content from a confirmation request for safe display.
 */
export function redactConfirmationRequest(
	request: TuiConfirmationRequest,
	redactFn: (value: string) => string,
): TuiConfirmationRequest {
	return {
		...request,
		message: redactFn(request.message),
		// Deep-copy and redact options
		options: request.options.map((o) => ({
			...o,
			consequence: o.consequence ? redactFn(o.consequence) : undefined,
			description: o.description ? redactFn(o.description) : undefined,
			label: redactFn(o.label),
		})),
		target: request.target
			? {
					...request.target,
					kind: redactFn(request.target.kind),
					safeDisplay: request.target.safeDisplay
						? redactFn(request.target.safeDisplay)
						: undefined,
				}
			: undefined,
		title: redactFn(request.title),
	};
}
