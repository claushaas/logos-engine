/** Workspace State Validation API — runtime validation with structured diagnostics */

import type { z } from 'zod';
import {
	type WorkspaceState,
	WorkspaceStateSchema,
} from './workspace-state.schema.js';

export interface WorkspaceStateValidationError {
	code: string;
	message: string;
	severity: 'error' | 'warning';
	path: string;
	recoveryHint?: string | undefined;
}

export interface WorkspaceStateValidationResult {
	success: boolean;
	state?: WorkspaceState;
	errors: WorkspaceStateValidationError[];
}

function zodIssueToValidationError(
	issue: z.ZodIssue,
): WorkspaceStateValidationError {
	const path = issue.path.length > 0 ? issue.path.join('.') : '(root)';
	let recoveryHint: string | undefined;
	if (path === 'schemaVersion') {
		recoveryHint =
			'Ensure the state includes a supported schemaVersion string.';
	} else if (path.startsWith('workspace.')) {
		recoveryHint =
			'Check workspace metadata fields for correct types and required values.';
	} else if (path.startsWith('provider.')) {
		recoveryHint = 'Provider config must store env-var names, not raw tokens.';
	} else if (path.startsWith('documentation.')) {
		recoveryHint = 'Documentation root must be a non-empty string.';
	}

	return {
		code: issue.code,
		message: issue.message,
		path,
		recoveryHint,
		severity: 'error',
	};
}

export function validateWorkspaceState(
	value: unknown,
): WorkspaceStateValidationResult {
	const parseResult = WorkspaceStateSchema.safeParse(value);
	if (parseResult.success) {
		return { errors: [], state: parseResult.data, success: true };
	}

	return {
		errors: parseResult.error.issues.map(zodIssueToValidationError),
		success: false,
	};
}

export function parseWorkspaceState(value: unknown): WorkspaceState {
	return WorkspaceStateSchema.parse(value);
}

export function safeParseWorkspaceState(
	value: unknown,
): WorkspaceStateValidationResult {
	return validateWorkspaceState(value);
}

/** Guard: reject raw secret values in provider config references */
export function isLikelyRawSecret(value: unknown): boolean {
	if (typeof value !== 'string') return false;
	const lower = value.toLowerCase();
	if (lower.startsWith('sk-')) return true;
	if (lower.startsWith('sk_')) return true;
	if (lower.startsWith('bearer ')) return true;
	if (lower.startsWith('basic ')) return true;
	if (lower.startsWith('api-')) return true;
	if (lower.startsWith('api_')) return true;
	if (
		value.length > 40 &&
		!value.includes('_') &&
		/[a-zA-Z0-9+/]{30,}/.test(value)
	)
		return true;
	if (/^(ghp|gho|ghu|ghs|ghr|xoxb|xoxp|dapi|sl|AKIA)/.test(value)) return true;
	return false;
}

export function redactSecretValue(value: string): string {
	if (value.length <= 8) return '***';
	return `${value.slice(0, 3)}...${value.slice(-3)}`;
}
