/** Intake Turn Repository — persist/read intake turns via workspace state */

import type { WorkspaceState } from '../state/workspace-state.schema.js';
import {
	readWorkspaceState,
	updateWorkspaceState,
	type WorkspaceStateRepositoryDiagnostic,
} from '../state/workspace-state-repository.js';
import type {
	CreateIntakeTurnOptions,
	CreateIntakeTurnResult,
	GetIntakeTurnOptions,
	GetIntakeTurnResult,
	IntakeTurn,
	IntakeTurnDiagnostic,
	ListIntakeTurnsOptions,
	ListIntakeTurnsResult,
	UpdateIntakeTurnOptions,
	UpdateIntakeTurnResult,
} from './intake-turn-types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function repoDiagToIntakeDiag(
	d: WorkspaceStateRepositoryDiagnostic,
): IntakeTurnDiagnostic {
	return {
		code: d.code,
		message: d.message,
		path: d.path,
		recoveryHint: d.recoveryHint,
		severity: d.severity,
	};
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export async function createIntakeTurn(
	options: CreateIntakeTurnOptions,
): Promise<CreateIntakeTurnResult> {
	const diagnostics: IntakeTurnDiagnostic[] = [];

	let createdTurn: IntakeTurn | undefined;

	const result = await updateWorkspaceState({
		_fs: options._fs,
		_testRandomId: options._testRandomId,
		_testTimestamp: options._testTimestamp,
		dryRun: options.dryRun,
		projectRoot: options.projectRoot,
		updater: (state: WorkspaceState) => {
			const updated = structuredClone(state);
			updated.intakeTurns = [...updated.intakeTurns, options.turn];
			createdTurn = updated.intakeTurns[updated.intakeTurns.length - 1];
			return updated;
		},
	});

	if (!result.success) {
		for (const d of result.diagnostics) {
			diagnostics.push(repoDiagToIntakeDiag(d));
		}
		return {
			changedPaths: result.changedPaths,
			diagnostics,
			dryRun: options.dryRun ?? false,
			success: false,
			turn: options.turn,
		};
	}

	return {
		changedPaths: result.changedPaths,
		diagnostics,
		dryRun: options.dryRun ?? false,
		success: true,
		turn: createdTurn ?? options.turn,
	};
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

export async function listIntakeTurns(
	options: ListIntakeTurnsOptions,
): Promise<ListIntakeTurnsResult> {
	const readResult = await readWorkspaceState({
		_fs: options._fs,
		projectRoot: options.projectRoot,
	});

	if (!readResult.success || !readResult.state) {
		return {
			diagnostics: readResult.diagnostics.map(repoDiagToIntakeDiag),
			success: false,
			turns: [],
		};
	}

	let turns = structuredClone(readResult.state.intakeTurns);

	// Filter by session if provided
	if (options.sessionId) {
		turns = turns.filter((t) => t.sessionId === options.sessionId);
	}

	// Filter by proposal ID if provided
	if (options.proposalId) {
		const pid = options.proposalId;
		turns = turns.filter((t) => t.derivedProposalIds.includes(pid));
	}

	// Sort by createdAt descending
	turns.sort((a, b) => {
		if (a.createdAt < b.createdAt) return 1;
		if (a.createdAt > b.createdAt) return -1;
		return a.id.localeCompare(b.id);
	});

	return {
		diagnostics: [],
		success: true,
		turns,
	};
}

// ---------------------------------------------------------------------------
// Get by ID
// ---------------------------------------------------------------------------

export async function getIntakeTurn(
	options: GetIntakeTurnOptions,
): Promise<GetIntakeTurnResult> {
	const listResult = await listIntakeTurns({
		_fs: options._fs,
		projectRoot: options.projectRoot,
	});

	if (!listResult.success) {
		return {
			diagnostics: listResult.diagnostics,
			success: false,
			turn: undefined,
		};
	}

	const turn = listResult.turns.find((t) => t.id === options.turnId);

	if (!turn) {
		return {
			diagnostics: [
				{
					code: 'LOGOS_INTAKE_TURN_NOT_FOUND',
					message: `Intake turn "${options.turnId}" not found.`,
					recoveryHint: 'Check the turn ID or list turns to find it.',
					severity: 'error',
				},
			],
			success: false,
			turn: undefined,
		};
	}

	return {
		diagnostics: [],
		success: true,
		turn,
	};
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

export async function updateIntakeTurn(
	options: UpdateIntakeTurnOptions,
): Promise<UpdateIntakeTurnResult> {
	const diagnostics: IntakeTurnDiagnostic[] = [];
	let updatedTurn: IntakeTurn | undefined;

	const result = await updateWorkspaceState({
		_fs: options._fs,
		_testRandomId: options._testRandomId,
		_testTimestamp: options._testTimestamp,
		dryRun: options.dryRun,
		projectRoot: options.projectRoot,
		updater: (state: WorkspaceState) => {
			const idx = state.intakeTurns.findIndex((t) => t.id === options.turnId);
			if (idx === -1) {
				diagnostics.push({
					code: 'LOGOS_INTAKE_TURN_NOT_FOUND',
					message: `Intake turn "${options.turnId}" not found.`,
					recoveryHint: 'Check the turn ID or list turns to find it.',
					severity: 'error',
				});
				return state;
			}

			const updated = structuredClone(state);
			const turn = updated.intakeTurns[idx];
			if (!turn) return state;

			if (options.update.status !== undefined) {
				turn.status = options.update.status;
			}
			if (options.update.derivedProposalIds !== undefined) {
				turn.derivedProposalIds = options.update.derivedProposalIds;
			}
			if (options.update.interpretation !== undefined) {
				turn.interpretation = options.update.interpretation;
			}
			if (options.update.diagnostics !== undefined) {
				turn.diagnostics = options.update.diagnostics;
			}

			updatedTurn = turn;
			return updated;
		},
	});

	if (!result.success) {
		for (const d of result.diagnostics) {
			diagnostics.push(repoDiagToIntakeDiag(d));
		}
		return {
			changedPaths: result.changedPaths,
			diagnostics,
			dryRun: options.dryRun ?? false,
			success: false,
			turn: undefined,
		};
	}

	const notFoundDiag = diagnostics.find(
		(d) => d.code === 'LOGOS_INTAKE_TURN_NOT_FOUND',
	);
	if (notFoundDiag) {
		return {
			changedPaths: result.changedPaths,
			diagnostics,
			dryRun: options.dryRun ?? false,
			success: false,
			turn: undefined,
		};
	}

	return {
		changedPaths: result.changedPaths,
		diagnostics,
		dryRun: options.dryRun ?? false,
		success: true,
		turn: updatedTurn,
	};
}
