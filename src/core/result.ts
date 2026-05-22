/**
 * LOGOS Core — Result envelope contracts.
 *
 * Defines the generic CoreResult envelope, notice/warning/blocker shapes,
 * changed-path metadata, and safe helper constructors.
 * All types are plain serializable data free of Pi or UI dependencies.
 */

import type { LogosError } from './errors.js';
import type { AssistantMessage } from './messages.js';

export type LogosSeverity = 'info' | 'warning' | 'error' | 'blocker';

export type LogosNoticeCode = string;

export type LogosNotice = {
	code: LogosNoticeCode;
	severity: LogosSeverity;
	message: string;
	details?: string;
	path?: string;
	metadata?: Record<string, unknown>;
};

export type LogosWarning = LogosNotice & {
	severity: 'warning';
};

export type LogosBlocker = LogosNotice & {
	severity: 'blocker';
};

export type ChangedPathKind =
	| 'created'
	| 'updated'
	| 'deleted'
	| 'unchanged'
	| 'skipped';

export type ChangedPath = {
	path: string;
	kind: ChangedPathKind;
	reason?: string;
};

export type CoreResultStatus =
	| 'ok'
	| 'blocked'
	| 'confirmation_required'
	| 'failed'
	| 'noop';

export type CoreResult<TData = unknown> = {
	status: CoreResultStatus;
	message: AssistantMessage;
	data?: TData;
	warnings: LogosWarning[];
	blockers: LogosBlocker[];
	errors: LogosError[];
	changedPaths: ChangedPath[];
	dryRun: boolean;
	metadata?: Record<string, unknown>;
};

export type CreateCoreResultInput<TData = unknown> = {
	status: CoreResultStatus;
	message: AssistantMessage;
	data?: TData;
	warnings?: LogosWarning[];
	blockers?: LogosBlocker[];
	errors?: LogosError[];
	changedPaths?: ChangedPath[];
	dryRun?: boolean;
	metadata?: Record<string, unknown>;
};

export function createCoreResult<TData>(
	input: CreateCoreResultInput<TData>,
): CoreResult<TData> {
	const result: CoreResult<TData> = {
		blockers: input.blockers ?? [],
		changedPaths: input.changedPaths ?? [],
		dryRun: input.dryRun ?? false,
		errors: input.errors ?? [],
		message: input.message,
		status: input.status,
		warnings: input.warnings ?? [],
	};

	if (input.data !== undefined) {
		result.data = input.data;
	}

	if (input.metadata !== undefined) {
		result.metadata = input.metadata;
	}

	return result;
}

export function createLogosWarning(input: {
	code: string;
	message: string;
	details?: string;
	path?: string;
	metadata?: Record<string, unknown>;
}): LogosWarning {
	const warning: LogosWarning = {
		code: input.code,
		message: input.message,
		severity: 'warning',
	};

	if (input.details !== undefined) {
		warning.details = input.details;
	}

	if (input.path !== undefined) {
		warning.path = input.path;
	}

	if (input.metadata !== undefined) {
		warning.metadata = input.metadata;
	}

	return warning;
}

export function createLogosBlocker(input: {
	code: string;
	message: string;
	details?: string;
	path?: string;
	metadata?: Record<string, unknown>;
}): LogosBlocker {
	const blocker: LogosBlocker = {
		code: input.code,
		message: input.message,
		severity: 'blocker',
	};

	if (input.details !== undefined) {
		blocker.details = input.details;
	}

	if (input.path !== undefined) {
		blocker.path = input.path;
	}

	if (input.metadata !== undefined) {
		blocker.metadata = input.metadata;
	}

	return blocker;
}

export function createLogosError(input: {
	code: LogosError['code'];
	message: string;
	details?: string;
	cause?: string;
	metadata?: Record<string, unknown>;
}): LogosError {
	const error: LogosError = {
		code: input.code,
		message: input.message,
	};

	if (input.details !== undefined) {
		error.details = input.details;
	}

	if (input.cause !== undefined) {
		error.cause = input.cause;
	}

	if (input.metadata !== undefined) {
		error.metadata = input.metadata;
	}

	return error;
}
