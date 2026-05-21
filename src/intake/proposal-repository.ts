/** Proposal Repository — persist proposals via workspace state repository */

import type { SafeFsAdapter } from '../fs/safe-filesystem.js';
import type {
	WorkspaceProposal,
	WorkspaceState,
} from '../state/workspace-state.schema.js';
import {
	readWorkspaceState,
	updateWorkspaceState,
	type WorkspaceStateRepositoryDiagnostic,
} from '../state/workspace-state-repository.js';
import type {
	ProposalDiagnostic,
	ProposalId,
	ReviewableProposal,
} from './proposal-types.js';

// ---------------------------------------------------------------------------
// Internal conversion
// ---------------------------------------------------------------------------

function workspaceProposalToReviewable(
	wp: WorkspaceProposal,
): ReviewableProposal {
	return {
		affectedDocumentIds: wp.affectedDocumentIds ?? [],
		auditEvents: (wp.auditEvents ?? []).map((a) => ({
			actor: a.actor,
			eventId: a.eventId,
			eventType: a.eventType,
			sessionRef: a.sessionRef,
			summary: a.summary,
			timestamp: a.timestamp,
		})),
		body: wp.body ?? '',
		caveat: wp.caveat,
		confidence: wp.confidence,
		createdAt: wp.createdAt ?? '',
		diagnostics: wp.diagnostics ?? [],
		evidence: wp.evidence,
		extractionMetadata: wp.extractionMetadata
			? {
					operation: wp.extractionMetadata.operation,
					providerId: wp.extractionMetadata.providerId,
					providerKind: wp.extractionMetadata.providerKind,
					responseId: wp.extractionMetadata.responseId,
				}
			: undefined,
		kind: wp.kind,
		proposalId: wp.proposalId,
		rejectionReason: wp.rejectionReason,
		revisionHistory: wp.revisionHistory
			? wp.revisionHistory.map((r) => ({
					previousBody: r.previousBody,
					previousTitle: r.previousTitle,
					reason: r.reason,
					revisedAt: r.revisedAt,
				}))
			: undefined,
		source: {
			answerId: wp.sourceAnswerId,
			documentCanonicalId: wp.sourceDocumentCanonicalId,
			phaseId: wp.sourcePhaseId,
			questionId: wp.sourceQuestionId,
			sessionId: wp.sourceSessionId,
		},
		sourceLabel: wp.sourceLabel,
		sourceTurnId: wp.sourceTurnId,
		status: wp.status,
		supersededByProposalId: wp.supersededByProposalId,
		targetConfirmedRecordId: wp.targetConfirmedRecordId,
		title: wp.title,
		updatedAt: wp.updatedAt ?? '',
	};
}

function reviewableToWorkspaceProposal(
	p: ReviewableProposal,
): WorkspaceProposal {
	return {
		affectedDocumentIds: p.affectedDocumentIds ?? [],
		auditEvents: (p.auditEvents ?? []).map((a) => ({
			actor: a.actor,
			changedPaths: [],
			commandRef: undefined,
			eventId: a.eventId,
			eventType: a.eventType,
			runRef: undefined,
			sessionRef: a.sessionRef,
			summary: a.summary,
			targetEntityRef: undefined,
			targetPath: undefined,
			timestamp: a.timestamp,
		})),
		body: p.body,
		caveat: p.caveat,
		confidence: p.confidence,
		createdAt: p.createdAt,
		diagnostics: p.diagnostics ?? [],
		evidence: p.evidence,
		extractionMetadata: p.extractionMetadata
			? {
					operation: p.extractionMetadata.operation,
					providerId: p.extractionMetadata.providerId,
					providerKind: p.extractionMetadata.providerKind,
					responseId: p.extractionMetadata.responseId,
				}
			: undefined,
		kind: p.kind,
		proposalId: p.proposalId,
		rejectionReason: p.rejectionReason,
		revisionHistory: p.revisionHistory
			? p.revisionHistory.map((r) => ({
					previousBody: r.previousBody,
					previousTitle: r.previousTitle,
					reason: r.reason,
					revisedAt: r.revisedAt,
				}))
			: undefined,
		sourceAnswerId: p.source.answerId,
		sourceDocumentCanonicalId: p.source.documentCanonicalId,
		sourceLabel: p.sourceLabel,
		sourcePhaseId: p.source.phaseId,
		sourceQuestionId: p.source.questionId,
		sourceSessionId: p.source.sessionId,
		sourceTurnId: p.sourceTurnId,
		status: p.status,
		supersededByProposalId: p.supersededByProposalId,
		targetConfirmedRecordId: p.targetConfirmedRecordId,
		title: p.title,
		updatedAt: p.updatedAt,
	};
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface CreateProposalOptions {
	proposal: ReviewableProposal;
	projectRoot: string;
	dryRun?: boolean | undefined;
	_fs?: SafeFsAdapter | undefined;
	_testTimestamp?: string | undefined;
	_testRandomId?: string | undefined;
}

export interface CreateProposalResult {
	success: boolean;
	proposal: ReviewableProposal;
	changedPaths: string[];
	diagnostics: ProposalDiagnostic[];
	dryRun: boolean;
}

export interface ListProposalsOptions {
	projectRoot: string;
	kind?: string | undefined;
	status?: string | undefined;
	_fs?: SafeFsAdapter | undefined;
}

export interface ListProposalsResult {
	success: boolean;
	proposals: ReviewableProposal[];
	diagnostics: ProposalDiagnostic[];
}

export interface GetProposalOptions {
	proposalId: ProposalId;
	projectRoot: string;
	_fs?: SafeFsAdapter | undefined;
}

export interface GetProposalResult {
	success: boolean;
	proposal: ReviewableProposal | undefined;
	diagnostics: ProposalDiagnostic[];
}

export interface UpdateProposalStatusOptions {
	proposalId: ProposalId;
	projectRoot: string;
	status: ReviewableProposal['status'];
	dryRun?: boolean | undefined;
	_fs?: SafeFsAdapter | undefined;
	_testTimestamp?: string | undefined;
	_testRandomId?: string | undefined;
}

export interface UpdateProposalStatusResult {
	success: boolean;
	proposal: ReviewableProposal | undefined;
	changedPaths: string[];
	diagnostics: ProposalDiagnostic[];
	dryRun: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function repoDiagToProposalDiag(
	d: WorkspaceStateRepositoryDiagnostic,
): ProposalDiagnostic {
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

export async function createProposal(
	options: CreateProposalOptions,
): Promise<CreateProposalResult> {
	return createProposals(options.projectRoot, [options.proposal], {
		_fs: options._fs,
		_testRandomId: options._testRandomId,
		_testTimestamp: options._testTimestamp,
		dryRun: options.dryRun,
	});
}

// ---------------------------------------------------------------------------
// Create multiple proposals at once
// ---------------------------------------------------------------------------

export interface CreateProposalsBatchOptions {
	projectRoot: string;
	proposals: ReviewableProposal[];
	dryRun?: boolean | undefined;
	_fs?: SafeFsAdapter | undefined;
	_testTimestamp?: string | undefined;
	_testRandomId?: string | undefined;
}

export async function createProposals(
	projectRoot: string,
	proposals: ReviewableProposal[],
	options: {
		dryRun?: boolean | undefined;
		_fs?: SafeFsAdapter | undefined;
		_testTimestamp?: string | undefined;
		_testRandomId?: string | undefined;
	} = {},
): Promise<CreateProposalResult> {
	const allDiagnostics: ProposalDiagnostic[] = [];
	let allChangedPaths: string[] = [];

	for (const proposal of proposals) {
		const wp = reviewableToWorkspaceProposal(proposal);

		const result = await updateWorkspaceState({
			_fs: options._fs,
			_testRandomId: options._testRandomId,
			_testTimestamp: options._testTimestamp,
			dryRun: options.dryRun,
			projectRoot,
			updater: (state: WorkspaceState) => {
				const updated = structuredClone(state);
				updated.proposals = [...updated.proposals, wp];
				return updated;
			},
		});

		if (!result.success) {
			for (const d of result.diagnostics) {
				allDiagnostics.push(repoDiagToProposalDiag(d));
			}
			return {
				changedPaths: allChangedPaths,
				diagnostics: allDiagnostics,
				dryRun: options.dryRun ?? false,
				proposal,
				success: false,
			};
		}

		allChangedPaths = [...allChangedPaths, ...result.changedPaths];
	}

	return {
		changedPaths: allChangedPaths,
		diagnostics: allDiagnostics,
		dryRun: options.dryRun ?? false,
		proposal: proposals[proposals.length - 1] ??
			proposals[0] ?? {
				affectedDocumentIds: [],
				auditEvents: undefined,
				body: '',
				caveat: undefined,
				confidence: undefined,
				createdAt: '',
				diagnostics: [],
				evidence: undefined,
				extractionMetadata: undefined,
				kind: 'decision',
				proposalId: 'unknown',
				rejectionReason: undefined,
				revisionHistory: undefined,
				source: {
					answerId: undefined,
					documentCanonicalId: undefined,
					phaseId: undefined,
					questionId: undefined,
					sessionId: undefined,
				},
				sourceLabel: undefined,
				sourceTurnId: undefined,
				status: 'proposed',
				supersededByProposalId: undefined,
				targetConfirmedRecordId: undefined,
				title: '',
				updatedAt: '',
			},
		success: true,
	};
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

export async function listProposals(
	options: ListProposalsOptions,
): Promise<ListProposalsResult> {
	const readResult = await readWorkspaceState({
		_fs: options._fs,
		projectRoot: options.projectRoot,
	});

	if (!readResult.success || !readResult.state) {
		return {
			diagnostics: readResult.diagnostics.map(repoDiagToProposalDiag),
			proposals: [],
			success: false,
		};
	}

	let proposals = readResult.state.proposals.map(workspaceProposalToReviewable);

	if (options.kind) {
		proposals = proposals.filter((p) => p.kind === options.kind);
	}
	if (options.status) {
		proposals = proposals.filter((p) => p.status === options.status);
	}

	return {
		diagnostics: [],
		proposals,
		success: true,
	};
}

// ---------------------------------------------------------------------------
// Get by ID
// ---------------------------------------------------------------------------

export async function getProposal(
	options: GetProposalOptions,
): Promise<GetProposalResult> {
	const listResult = await listProposals({
		_fs: options._fs,
		projectRoot: options.projectRoot,
	});

	if (!listResult.success) {
		return {
			diagnostics: listResult.diagnostics,
			proposal: undefined,
			success: false,
		};
	}

	const proposal = listResult.proposals.find(
		(p) => p.proposalId === options.proposalId,
	);

	if (!proposal) {
		return {
			diagnostics: [
				{
					code: 'E_PROPOSAL_NOT_FOUND',
					message: `Proposal "${options.proposalId}" not found.`,
					path: `proposals.${options.proposalId}`,
					recoveryHint: 'Check the proposal ID or list proposals to find it.',
					severity: 'error',
				},
			],
			proposal: undefined,
			success: false,
		};
	}

	return {
		diagnostics: [],
		proposal,
		success: true,
	};
}

// ---------------------------------------------------------------------------
// Update proposal status (generic)
// ---------------------------------------------------------------------------

export async function updateProposalStatus(
	options: UpdateProposalStatusOptions,
): Promise<UpdateProposalStatusResult> {
	const diagnostics: ProposalDiagnostic[] = [];

	const result = await updateWorkspaceState({
		_fs: options._fs,
		_testRandomId: options._testRandomId,
		_testTimestamp: options._testTimestamp,
		dryRun: options.dryRun,
		projectRoot: options.projectRoot,
		updater: (state: WorkspaceState) => {
			const idx = state.proposals.findIndex(
				(p) => p.proposalId === options.proposalId,
			);
			if (idx === -1) return state;

			const updated = structuredClone(state);
			const proposal = updated.proposals[idx];
			if (proposal) {
				proposal.status = options.status;
				proposal.updatedAt = new Date().toISOString();
			}
			return updated;
		},
	});

	if (!result.success) {
		for (const d of result.diagnostics) {
			diagnostics.push(repoDiagToProposalDiag(d));
		}
		return {
			changedPaths: result.changedPaths,
			diagnostics,
			dryRun: options.dryRun ?? false,
			proposal: undefined,
			success: false,
		};
	}

	const wp = result.state.proposals.find(
		(p) => p.proposalId === options.proposalId,
	);

	return {
		changedPaths: result.changedPaths,
		diagnostics,
		dryRun: options.dryRun ?? false,
		proposal: wp ? workspaceProposalToReviewable(wp) : undefined,
		success: true,
	};
}

// ---------------------------------------------------------------------------
// In-memory helpers for tests (no filesystem access)
// ---------------------------------------------------------------------------

export function findProposalInState(
	state: WorkspaceState,
	proposalId: ProposalId,
): WorkspaceProposal | undefined {
	return state.proposals.find((p) => p.proposalId === proposalId);
}

export function listProposalsFromState(
	state: WorkspaceState,
): ReviewableProposal[] {
	return state.proposals.map(workspaceProposalToReviewable);
}
