/**
 * Confirmation resolver — maps confirmed options to operation execution.
 *
 * Phase 4: Keyboard Confirmation Framework — Outcome 5 (confirmation service/action resolver).
 *
 * The resolver validates pending confirmation id, checks option validity,
 * rejects stale/mismatched ids, and delegates execution to the existing
 * service paths. It does NOT mutate state directly — it returns messages
 * and the calling code (App.tsx) calls the actual service.
 */

import { createDiagnostic } from '../runtime/diagnostics.js';
import type {
	ConfirmationActionKind,
	TuiConfirmationRequest,
	TuiConfirmationResult,
} from './confirmation-model.js';
import { CONFIRMATION_DIAGNOSTIC_CODES } from './confirmation-model.js';
import type { ConfirmationState } from './confirmation-state.js';
import {
	isConfirmationExpired,
	validateConfirmationId,
	validateConfirmationOption,
} from './confirmation-state.js';

// ---------------------------------------------------------------------------
// Resolver input
// ---------------------------------------------------------------------------

export interface ResolveTuiConfirmationOptions {
	/** The confirmation request being resolved */
	request: TuiConfirmationRequest;

	/** The selected option id */
	selectedOptionId: string;

	/** Current confirmation state for validation */
	state: ConfirmationState;

	/** Current timestamp for expiry check */
	now?: string | undefined;
}

// ---------------------------------------------------------------------------
// Resolver
// ---------------------------------------------------------------------------

/**
 * Resolve a TUI confirmation.
 *
 * Returns a result indicating whether execution should proceed and what
 * the next action is. The caller (App.tsx) is responsible for actually
 * invoking the appropriate service path.
 */
export function resolveTuiConfirmation(
	options: ResolveTuiConfirmationOptions,
): TuiConfirmationResult {
	const { request, selectedOptionId, state, now } = options;

	// 1. Validate confirmation id matches pending
	if (!validateConfirmationId(state, request.id)) {
		return {
			confirmationId: request.id,
			diagnostics: [
				createDiagnostic({
					code: CONFIRMATION_DIAGNOSTIC_CODES.CONFIRMATION_TARGET_MISMATCH,
					message:
						'Confirmation id does not match the pending confirmation. The context may have changed.',
					recoveryHints: [
						{
							category: 'run_command',
							message:
								'Re-run the original command to create a new confirmation.',
						},
					],
					severity: 'error',
				}),
			],
			messages: [],
			nextActions: ['Re-run the original command.'],
			outcome: 'stale',
			selectedOptionId,
		};
	}

	// 2. Validate option exists
	if (!validateConfirmationOption(state, selectedOptionId)) {
		return {
			confirmationId: request.id,
			diagnostics: [
				createDiagnostic({
					code: CONFIRMATION_DIAGNOSTIC_CODES.CONFIRMATION_OPTION_INVALID,
					message: `Selected option "${selectedOptionId}" is not valid for this confirmation.`,
					recoveryHints: [
						{
							category: 'run_command',
							message: 'Re-run the original command.',
						},
					],
					severity: 'error',
				}),
			],
			messages: [],
			nextActions: ['Re-run the original command.'],
			outcome: 'invalid_option',
			selectedOptionId,
		};
	}

	// 3. Check expiry
	if (isConfirmationExpired(request, now ?? new Date().toISOString())) {
		return {
			confirmationId: request.id,
			diagnostics: [
				createDiagnostic({
					code: CONFIRMATION_DIAGNOSTIC_CODES.CONFIRMATION_EXPIRED,
					message: 'This confirmation has expired.',
					recoveryHints: [
						{
							category: 'run_command',
							message: 'Re-run the original command for a fresh confirmation.',
						},
					],
					severity: 'error',
				}),
			],
			messages: [],
			nextActions: ['Re-run the original command.'],
			outcome: 'expired',
			selectedOptionId,
		};
	}

	// 4. Find the selected option
	const option = request.options.find((o) => o.id === selectedOptionId);
	if (!option) {
		return {
			confirmationId: request.id,
			diagnostics: [
				createDiagnostic({
					code: CONFIRMATION_DIAGNOSTIC_CODES.CONFIRMATION_OPTION_INVALID,
					message: 'Selected option not found.',
					severity: 'error',
				}),
			],
			messages: [],
			nextActions: ['Re-run the original command.'],
			outcome: 'invalid_option',
			selectedOptionId,
		};
	}

	// 5. Cancel/no → safe abort
	if (option.kind === 'cancel' || option.kind === 'reject') {
		return {
			confirmationId: request.id,
			diagnostics: [
				createDiagnostic({
					code: CONFIRMATION_DIAGNOSTIC_CODES.CONFIRMATION_CANCELLED,
					message: 'Action cancelled by user. No changes were made.',
					severity: 'info',
				}),
			],
			messages: [
				`Action "${request.title}" was cancelled.`,
				'No files were written, no state was changed.',
			],
			nextActions: ['You can re-run the original command when ready.'],
			outcome: 'cancelled',
			selectedOptionId,
		};
	}

	// 6. Accept/confirm → proceed
	const actionLabel = getActionLabel(request.actionKind);
	return {
		confirmationId: request.id,
		diagnostics: [
			createDiagnostic({
				code: CONFIRMATION_DIAGNOSTIC_CODES.CONFIRMATION_ACCEPTED,
				message: `Accepted: ${request.title}`,
				severity: 'info',
			}),
		],
		messages: [`Executing: ${request.title}`, '', `Selected: ${option.label}`],
		nextActions: actionLabel ? ['Running /status to see results.'] : [],
		outcome: 'accepted',
		selectedOptionId,
	};
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getActionLabel(kind: ConfirmationActionKind): string | undefined {
	switch (kind) {
		case 'workspace_init':
			return 'Workspace initialization will proceed.';
		case 'canonical_generation':
			return 'Canonical documentation generation will proceed.';
		case 'executive_compile':
			return 'Executive compilation will proceed.';
		case 'provider_disclosure':
			return 'Remote provider disclosure will be accepted.';
		case 'proposal_accept':
			return 'Proposal will be accepted as confirmed state.';
		case 'proposal_revise':
			return 'Proposal will be revised.';
		case 'proposal_reject':
			return 'Proposal will be rejected.';
		case 'proposal_defer':
			return 'Proposal will be deferred.';
		case 'decision_revise':
			return 'Decision will be revised.';
		case 'decision_supersede':
			return 'Decision will be superseded.';
		case 'write_collision':
			return 'Write collision resolution will proceed.';
		case 'config_change':
			return 'Configuration change will proceed.';
		default:
			return undefined;
	}
}

/**
 * Build the command that should be executed after confirmation is accepted.
 * Returns the slash command string and args to be routed.
 */
export function getConfirmedCommand(
	request: TuiConfirmationRequest,
): { command: string; args: string[] } | undefined {
	const source = request.sourceCommand;
	const parts = source.split(/\s+/);

	// /init → /init --confirm
	if (request.actionKind === 'workspace_init') {
		const args = parts
			.slice(1)
			.filter((a) => a !== '--confirm' && a !== '--dry-run');
		args.push('--confirm');
		return { args, command: '/init' };
	}

	// /generate → /generate --confirm (preserve --policy)
	if (request.actionKind === 'canonical_generation') {
		const args = parts
			.slice(1)
			.filter((a) => a !== '--confirm' && a !== '--dry-run');
		args.push('--confirm');
		return { args, command: '/generate' };
	}

	// /executive compile → /executive compile --confirm
	if (request.actionKind === 'executive_compile') {
		const args = parts
			.slice(1)
			.filter((a) => a !== '--confirm' && a !== '--dry-run');
		args.push('--confirm');
		return { args, command: '/executive' };
	}

	// /config ai disclosure accept
	if (request.actionKind === 'provider_disclosure') {
		return {
			args: ['ai', 'disclosure', 'accept'],
			command: '/config',
		};
	}

	// For proposal actions, return /proposals with original subcommand args
	if (
		request.actionKind === 'proposal_accept' ||
		request.actionKind === 'proposal_revise' ||
		request.actionKind === 'proposal_reject' ||
		request.actionKind === 'proposal_defer'
	) {
		return { args: parts.slice(1), command: '/proposals' };
	}

	// For decision actions, return /decisions with original subcommand args
	if (
		request.actionKind === 'decision_revise' ||
		request.actionKind === 'decision_supersede'
	) {
		return { args: parts.slice(1), command: '/decisions' };
	}

	return undefined;
}
