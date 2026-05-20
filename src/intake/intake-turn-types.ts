/** Intake Turn Types — typed contracts for conversation turn persistence */

import type { WorkspaceIntakeTurn } from '../state/workspace-state.schema.js';

// ---------------------------------------------------------------------------
// Re-export from state schema for convenience
// ---------------------------------------------------------------------------

export type IntakeTurn = WorkspaceIntakeTurn;

export type IntakeTurnRole = IntakeTurn['role'];
export type IntakeTurnStatus = IntakeTurn['status'];

export const INTAKE_TURN_ROLE_VALUES: IntakeTurnRole[] = [
	'user',
	'assistant',
	'system',
	'provider',
	'deterministic_interpreter',
];

export const INTAKE_TURN_STATUS_VALUES: IntakeTurnStatus[] = [
	'captured',
	'interpreted',
	'proposed',
	'failed',
	'deferred',
	'unknown',
];

// ---------------------------------------------------------------------------
// Repository options / results
// ---------------------------------------------------------------------------

export interface CreateIntakeTurnOptions {
	turn: IntakeTurn;
	projectRoot: string;
	dryRun?: boolean | undefined;
	_fs?: import('../fs/safe-filesystem.js').SafeFsAdapter | undefined;
	_testTimestamp?: string | undefined;
	_testRandomId?: string | undefined;
}

export interface CreateIntakeTurnResult {
	success: boolean;
	turn: IntakeTurn;
	changedPaths: string[];
	diagnostics: IntakeTurnDiagnostic[];
	dryRun: boolean;
}

export interface ListIntakeTurnsOptions {
	projectRoot: string;
	sessionId?: string | undefined;
	proposalId?: string | undefined;
	_fs?: import('../fs/safe-filesystem.js').SafeFsAdapter | undefined;
}

export interface ListIntakeTurnsResult {
	success: boolean;
	turns: IntakeTurn[];
	diagnostics: IntakeTurnDiagnostic[];
}

export interface GetIntakeTurnOptions {
	turnId: string;
	projectRoot: string;
	_fs?: import('../fs/safe-filesystem.js').SafeFsAdapter | undefined;
}

export interface GetIntakeTurnResult {
	success: boolean;
	turn: IntakeTurn | undefined;
	diagnostics: IntakeTurnDiagnostic[];
}

export interface UpdateIntakeTurnOptions {
	turnId: string;
	projectRoot: string;
	update: {
		derivedProposalIds?: string[] | undefined;
		interpretation?: IntakeTurn['interpretation'] | undefined;
		status?: IntakeTurnStatus | undefined;
		diagnostics?: IntakeTurn['diagnostics'] | undefined;
	};
	dryRun?: boolean | undefined;
	_fs?: import('../fs/safe-filesystem.js').SafeFsAdapter | undefined;
	_testTimestamp?: string | undefined;
	_testRandomId?: string | undefined;
}

export interface UpdateIntakeTurnResult {
	success: boolean;
	turn: IntakeTurn | undefined;
	changedPaths: string[];
	diagnostics: IntakeTurnDiagnostic[];
	dryRun: boolean;
}

export interface IntakeTurnDiagnostic {
	code: string;
	severity: 'error' | 'warning' | 'info';
	message: string;
	path?: string | undefined;
	recoveryHint?: string | undefined;
}
