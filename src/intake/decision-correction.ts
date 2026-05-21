/** Decision Correction Service — revise and supersede confirmed decisions */

import type { SafeFsAdapter } from '../fs/safe-filesystem.js';
import type { WorkspaceState } from '../state/workspace-state.schema.js';
import { updateWorkspaceState } from '../state/workspace-state-repository.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DecisionCorrectionDiagnostic {
	code: string;
	severity: 'error' | 'warning' | 'info';
	message: string;
	recoveryHint?: string | undefined;
}

export interface ReviseDecisionOptions {
	decisionId: string;
	projectRoot: string;
	newTitle: string;
	newBody: string;
	dryRun?: boolean | undefined;
	_fs?: SafeFsAdapter | undefined;
	_testTimestamp?: string | undefined;
	_testRandomId?: string | undefined;
}

export interface ReviseDecisionResult {
	success: boolean;
	decisionId: string;
	affectedDocuments: string[];
	changedPaths: string[];
	diagnostics: DecisionCorrectionDiagnostic[];
}

export interface SupersedeDecisionOptions {
	decisionId: string;
	projectRoot: string;
	newTitle: string;
	newBody: string;
	dryRun?: boolean | undefined;
	_fs?: SafeFsAdapter | undefined;
	_testTimestamp?: string | undefined;
	_testRandomId?: string | undefined;
}

export interface SupersedeDecisionResult {
	success: boolean;
	decisionId: string;
	newDecisionId: string;
	affectedDocuments: string[];
	changedPaths: string[];
	diagnostics: DecisionCorrectionDiagnostic[];
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

function makeEventId(): string {
	return `audit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export async function reviseDecision(
	options: ReviseDecisionOptions,
): Promise<ReviseDecisionResult> {
	const diagnostics: DecisionCorrectionDiagnostic[] = [];
	let affectedDocuments: string[] = [];

	const result = await updateWorkspaceState({
		_fs: options._fs,
		_testRandomId: options._testRandomId,
		_testTimestamp: options._testTimestamp,
		dryRun: options.dryRun,
		projectRoot: options.projectRoot,
		updater: (state: WorkspaceState) => {
			const idx = state.decisions.findIndex((d) => d.id === options.decisionId);
			if (idx === -1) {
				diagnostics.push({
					code: 'LOGOS_DECISION_NOT_FOUND',
					message: `Decision "${options.decisionId}" not found.`,
					recoveryHint: 'Run /decisions list to see all confirmed decisions.',
					severity: 'error',
				});
				return state;
			}

			const decision = state.decisions[idx];
			if (!decision) return state;

			const updated = structuredClone(state);
			const now = new Date().toISOString();

			// Audit event for revision
			const audit = {
				actor: 'user',
				changedPaths: [] as string[],
				eventId: makeEventId(),
				eventType: 'decision_revised',
				summary: `Decision "${options.decisionId}" revised to: ${options.newTitle.substring(0, 80)}`,
				timestamp: now,
			};

			// Preserve original history in source refs
			updated.decisions[idx] = {
				...decision,
				body: options.newBody,
				sourceRefs: [...decision.sourceRefs, `revised:${now}`],
				title: options.newTitle,
				updatedAt: now,
			};

			affectedDocuments = decision.affectedDocumentIds ?? [];

			// Mark affected artifacts as stale
			updated.artifacts = updated.artifacts.map((a) => {
				if (a.sourceDocumentIds.some((id) => affectedDocuments.includes(id))) {
					return { ...a, status: 'stale' as const };
				}
				return a;
			});

			// Add audit event
			updated.auditEvents = [...updated.auditEvents, audit];

			return updated;
		},
	});

	if (!result.success) {
		for (const d of result.diagnostics) {
			diagnostics.push({
				code: d.code,
				message: d.message,
				recoveryHint: d.recoveryHint,
				severity: d.severity,
			});
		}
	}

	const notFoundDiag = diagnostics.find(
		(d) => d.code === 'LOGOS_DECISION_NOT_FOUND',
	);

	return {
		affectedDocuments,
		changedPaths: result.changedPaths,
		decisionId: options.decisionId,
		diagnostics,
		success: result.success && !notFoundDiag,
	};
}

export async function supersedeDecision(
	options: SupersedeDecisionOptions,
): Promise<SupersedeDecisionResult> {
	const diagnostics: DecisionCorrectionDiagnostic[] = [];
	let affectedDocuments: string[] = [];
	let newDecisionId = '';

	const result = await updateWorkspaceState({
		_fs: options._fs,
		_testRandomId: options._testRandomId,
		_testTimestamp: options._testTimestamp,
		dryRun: options.dryRun,
		projectRoot: options.projectRoot,
		updater: (state: WorkspaceState) => {
			const idx = state.decisions.findIndex((d) => d.id === options.decisionId);
			if (idx === -1) {
				diagnostics.push({
					code: 'LOGOS_DECISION_NOT_FOUND',
					message: `Decision "${options.decisionId}" not found.`,
					recoveryHint: 'Run /decisions list to see all confirmed decisions.',
					severity: 'error',
				});
				return state;
			}

			const decision = state.decisions[idx];
			if (!decision) return state;

			const updated = structuredClone(state);
			const now = new Date().toISOString();

			// Audit event for supersession
			const audit = {
				actor: 'user',
				changedPaths: [] as string[],
				eventId: makeEventId(),
				eventType: 'decision_superseded',
				summary: `Decision "${options.decisionId}" superseded by new decision "${newDecisionId || 'pending'}"`,
				timestamp: now,
			};

			// Mark old decision as superseded
			updated.decisions[idx] = {
				...decision,
				status: 'superseded',
				updatedAt: now,
			};

			affectedDocuments = decision.affectedDocumentIds ?? [];

			// Create new decision referencing the old one
			newDecisionId = `dec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
			const newDecision = {
				...decision,
				body: options.newBody,
				createdAt: now,
				id: newDecisionId,
				sourceRefs: [...decision.sourceRefs, `supersedes:${decision.id}`],
				status: 'confirmed' as const,
				title: options.newTitle,
				updatedAt: now,
			};

			updated.decisions = [...updated.decisions, newDecision];

			// Add audit event
			updated.auditEvents = [...updated.auditEvents, audit];

			// Mark affected artifacts as stale
			updated.artifacts = updated.artifacts.map((a) => {
				if (a.sourceDocumentIds.some((id) => affectedDocuments.includes(id))) {
					return { ...a, status: 'stale' as const };
				}
				return a;
			});

			return updated;
		},
	});

	if (!result.success) {
		for (const d of result.diagnostics) {
			diagnostics.push({
				code: d.code,
				message: d.message,
				recoveryHint: d.recoveryHint,
				severity: d.severity,
			});
		}
	}

	const notFoundDiag = diagnostics.find(
		(d) => d.code === 'LOGOS_DECISION_NOT_FOUND',
	);

	return {
		affectedDocuments,
		changedPaths: result.changedPaths,
		decisionId: options.decisionId,
		diagnostics,
		newDecisionId,
		success: result.success && !notFoundDiag,
	};
}
