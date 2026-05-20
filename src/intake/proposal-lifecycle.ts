/** Proposal Lifecycle — accept, reject, and revise operations on proposals */

import type {
	WorkspaceAssumption,
	WorkspaceDecision,
	WorkspaceOpenQuestion,
	WorkspaceRisk,
	WorkspaceState,
} from '../state/workspace-state.schema.js';
import {
	readWorkspaceState,
	updateWorkspaceState,
} from '../state/workspace-state-repository.js';
import type {
	AcceptProposalOptions,
	ProposalDiagnostic,
	ProposalId,
	ProposalLifecycleResult,
	ProposalRevision,
	RejectProposalOptions,
	ReviewableProposal,
	ReviseProposalOptions,
} from './proposal-types.js';

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

interface ProposalRecord {
	proposalId: string;
	kind: string;
	status: string;
	title: string;
	body: string;
	sourceAnswerId: string | undefined;
	sourceSessionId: string | undefined;
	sourceQuestionId: string | undefined;
	sourceDocumentCanonicalId: string | undefined;
	sourcePhaseId: string | undefined;
	evidence: string | undefined;
	confidence: string | undefined;
	extractionMetadata:
		| {
				providerId?: string | undefined;
				providerKind?: string | undefined;
				responseId?: string | undefined;
				operation?: string | undefined;
		  }
		| undefined;
	revisionHistory: ProposalRevision[] | undefined;
	targetConfirmedRecordId: string | undefined;
}

function buildExtractionMeta(src: {
	operation?: string | undefined;
	providerId?: string | undefined;
	providerKind?: string | undefined;
	responseId?: string | undefined;
}): ProposalRecord['extractionMetadata'] {
	const out: NonNullable<ProposalRecord['extractionMetadata']> = {};
	if (src.operation !== undefined) out.operation = src.operation;
	if (src.providerId !== undefined) out.providerId = src.providerId;
	if (src.providerKind !== undefined) out.providerKind = src.providerKind;
	if (src.responseId !== undefined) out.responseId = src.responseId;
	return Object.keys(out).length > 0 ? out : undefined;
}

function getProposalFromState(
	state: WorkspaceState,
	proposalId: ProposalId,
): ProposalRecord | undefined {
	const p = state.proposals.find((pp) => pp.proposalId === proposalId);
	if (!p) return undefined;
	return {
		body: p.body ?? '',
		confidence: p.confidence,
		evidence: p.evidence,
		extractionMetadata: p.extractionMetadata
			? buildExtractionMeta(p.extractionMetadata)
			: undefined,
		kind: p.kind,
		proposalId: p.proposalId,
		revisionHistory: p.revisionHistory
			? p.revisionHistory.map((r) => ({
					previousBody: r.previousBody,
					previousTitle: r.previousTitle,
					reason: r.reason,
					revisedAt: r.revisedAt,
				}))
			: undefined,
		sourceAnswerId: p.sourceAnswerId,
		sourceDocumentCanonicalId: p.sourceDocumentCanonicalId,
		sourcePhaseId: p.sourcePhaseId,
		sourceQuestionId: p.sourceQuestionId,
		sourceSessionId: p.sourceSessionId,
		status: p.status,
		targetConfirmedRecordId: p.targetConfirmedRecordId,
		title: p.title,
	};
}

function proposalFromRecord(r: ProposalRecord): ReviewableProposal {
	return {
		affectedDocumentIds: [],
		auditEvents: undefined,
		body: r.body,
		caveat: undefined,
		confidence: r.confidence as ReviewableProposal['confidence'],
		createdAt: '',
		diagnostics: [],
		evidence: r.evidence,
		extractionMetadata: r.extractionMetadata,
		kind: r.kind as ReviewableProposal['kind'],
		proposalId: r.proposalId,
		rejectionReason: undefined,
		revisionHistory: r.revisionHistory,
		source: {
			answerId: r.sourceAnswerId,
			documentCanonicalId: r.sourceDocumentCanonicalId,
			phaseId: r.sourcePhaseId,
			questionId: r.sourceQuestionId,
			sessionId: r.sourceSessionId,
		},
		sourceLabel: undefined,
		sourceTurnId: undefined,
		status: r.status as ReviewableProposal['status'],
		supersededByProposalId: undefined,
		targetConfirmedRecordId: r.targetConfirmedRecordId,
		title: r.title,
		updatedAt: '',
	};
}

function mkDiag(
	code: string,
	message: string,
	severity: ProposalDiagnostic['severity'] = 'error',
	path?: string,
	recoveryHint?: string,
): ProposalDiagnostic {
	return { code, message, path, recoveryHint, severity };
}

// ---------------------------------------------------------------------------
// Validate state transitions
// ---------------------------------------------------------------------------

function validateTransition(
	currentStatus: string,
	targetAction: string,
): ProposalDiagnostic | undefined {
	switch (targetAction) {
		case 'accept': {
			if (currentStatus === 'accepted') {
				// Already accepted — idempotent, not an error
				return mkDiag(
					'W_ALREADY_ACCEPTED',
					`Proposal is already accepted.`,
					'warning',
					undefined,
					'No action needed.',
				);
			}
			if (currentStatus !== 'proposed') {
				return mkDiag(
					'E_INVALID_TRANSITION',
					`Cannot accept proposal with status "${currentStatus}"; only "proposed" proposals can be accepted.`,
					'error',
					`proposals.${currentStatus}`,
					'Only proposals with status "proposed" may be accepted.',
				);
			}
			return undefined;
		}
		case 'reject': {
			if (currentStatus === 'rejected') {
				return mkDiag(
					'W_ALREADY_REJECTED',
					`Proposal is already rejected.`,
					'warning',
					undefined,
					'No action needed.',
				);
			}
			if (currentStatus === 'accepted') {
				return mkDiag(
					'E_INVALID_TRANSITION',
					`Cannot reject proposal with status "${currentStatus}"; accepted proposals must be revised first.`,
					'error',
					`proposals.${currentStatus}`,
				);
			}
			return undefined;
		}
		case 'revise': {
			if (currentStatus === 'superseded') {
				return mkDiag(
					'E_INVALID_TRANSITION',
					`Cannot revise proposal with status "${currentStatus}"; it has been superseded.`,
					'error',
					`proposals.${currentStatus}`,
				);
			}
			return undefined;
		}
		default:
			return undefined;
	}
}

// ---------------------------------------------------------------------------
// Accept
// ---------------------------------------------------------------------------

export async function acceptProposal(
	options: AcceptProposalOptions,
): Promise<ProposalLifecycleResult> {
	const diagnostics: ProposalDiagnostic[] = [];
	let changedPaths: string[] = [];
	const clock = options.clock ?? { now: () => new Date().toISOString() };
	const idFactory =
		options.idFactory ??
		(() => `rec-${Math.random().toString(36).slice(2, 10)}`);

	let finalProposal: ReviewableProposal | undefined;

	const result = await updateWorkspaceState({
		_fs: options._fs,
		_testRandomId: options._testRandomId,
		_testTimestamp: options._testTimestamp,
		dryRun: options.dryRun,
		projectRoot: options.projectRoot,
		updater: (state: WorkspaceState) => {
			const proposalIdx = state.proposals.findIndex(
				(p) => p.proposalId === options.proposalId,
			);
			if (proposalIdx === -1) {
				diagnostics.push(
					mkDiag(
						'E_PROPOSAL_NOT_FOUND',
						`Proposal "${options.proposalId}" not found.`,
						'error',
						`proposals.${options.proposalId}`,
					),
				);
				return state;
			}

			const proposal = state.proposals[proposalIdx];
			if (!proposal) return state;
			const currentStatus = proposal.status;

			// Validate transition
			const transitionDiag = validateTransition(currentStatus, 'accept');
			if (transitionDiag) {
				diagnostics.push(transitionDiag);
				// Idempotent accept: already accepted is a warning, not a blocking error
				if (transitionDiag.code === 'W_ALREADY_ACCEPTED') {
					finalProposal = proposalFromRecord(
						getProposalFromState(state, options.proposalId) ?? {
							body: proposal.body ?? '',
							confidence: proposal.confidence,
							evidence: proposal.evidence,
							extractionMetadata: proposal.extractionMetadata,
							kind: proposal.kind,
							proposalId: proposal.proposalId,
							revisionHistory: undefined,
							sourceAnswerId: proposal.sourceAnswerId,
							sourceDocumentCanonicalId: proposal.sourceDocumentCanonicalId,
							sourcePhaseId: proposal.sourcePhaseId,
							sourceQuestionId: proposal.sourceQuestionId,
							sourceSessionId: proposal.sourceSessionId,
							status: 'accepted',
							targetConfirmedRecordId: proposal.targetConfirmedRecordId,
							title: proposal.title,
						},
					);
					return state;
				}
				return state;
			}

			const now = clock.now();
			const updated = structuredClone(state);
			const recordId = idFactory();

			// Create confirmed record based on kind
			switch (proposal.kind) {
				case 'decision': {
					const decision: WorkspaceDecision = {
						affectedDocumentIds: [
							proposal.sourceDocumentCanonicalId ?? '',
						].filter(Boolean),
						body: proposal.body ?? '',
						confidence: proposal.confidence,
						createdAt: now,
						id: recordId,
						sourceRefs: [
							`proposal:${proposal.proposalId}`,
							`answer:${proposal.sourceAnswerId ?? 'unknown'}`,
							`session:${proposal.sourceSessionId ?? 'unknown'}`,
						].filter((s) => !s.includes(':undefined')),
						status: 'confirmed',
						title: proposal.title,
						updatedAt: now,
					};
					updated.decisions = [...updated.decisions, decision];
					break;
				}
				case 'assumption': {
					const assumption: WorkspaceAssumption = {
						affectedDocumentIds: [
							proposal.sourceDocumentCanonicalId ?? '',
						].filter(Boolean),
						body: proposal.body ?? '',
						caveat: undefined,
						createdAt: now,
						id: recordId,
						sourceRefs: [
							`proposal:${proposal.proposalId}`,
							`answer:${proposal.sourceAnswerId ?? 'unknown'}`,
							`session:${proposal.sourceSessionId ?? 'unknown'}`,
						].filter((s) => !s.includes(':undefined')),
						status: 'active',
						title: proposal.title,
						updatedAt: now,
					};
					updated.assumptions = [...updated.assumptions, assumption];
					break;
				}
				case 'hypothesis': {
					// Hypotheses map to assumptions by default
					const hypothesis: WorkspaceAssumption = {
						affectedDocumentIds: [
							proposal.sourceDocumentCanonicalId ?? '',
						].filter(Boolean),
						body: proposal.body ?? '',
						caveat: `Hypothesis from proposal ${proposal.proposalId}`,
						createdAt: now,
						id: recordId,
						sourceRefs: [
							`proposal:${proposal.proposalId}`,
							`answer:${proposal.sourceAnswerId ?? 'unknown'}`,
							`session:${proposal.sourceSessionId ?? 'unknown'}`,
						].filter((s) => !s.includes(':undefined')),
						status: 'proposed',
						title: `[Hypothesis] ${proposal.title}`,
						updatedAt: now,
					};
					updated.assumptions = [...updated.assumptions, hypothesis];
					break;
				}
				case 'open_question': {
					const question: WorkspaceOpenQuestion = {
						affectedDocumentIds: [
							proposal.sourceDocumentCanonicalId ?? '',
						].filter(Boolean),
						body: proposal.body ?? '',
						createdAt: now,
						id: recordId,
						question: proposal.title,
						sourceRefs: [
							`proposal:${proposal.proposalId}`,
							`answer:${proposal.sourceAnswerId ?? 'unknown'}`,
							`session:${proposal.sourceSessionId ?? 'unknown'}`,
						].filter((s) => !s.includes(':undefined')),
						status: 'open',
						updatedAt: now,
					};
					updated.openQuestions = [...updated.openQuestions, question];
					break;
				}
				case 'risk': {
					const risk: WorkspaceRisk = {
						affectedDocumentIds: [
							proposal.sourceDocumentCanonicalId ?? '',
						].filter(Boolean),
						body: proposal.body ?? '',
						createdAt: now,
						id: recordId,
						rationale: `Risk from proposal ${proposal.proposalId}`,
						severity: 'medium',
						sourceRefs: [
							`proposal:${proposal.proposalId}`,
							`answer:${proposal.sourceAnswerId ?? 'unknown'}`,
							`session:${proposal.sourceSessionId ?? 'unknown'}`,
						].filter((s) => !s.includes(':undefined')),
						status: 'identified',
						title: proposal.title,
						updatedAt: now,
					};
					updated.risks = [...updated.risks, risk];
					break;
				}
				case 'document_content_hint': {
					// Document content hints do not create confirmed records
					// They stay as accepted proposals with metadata
					diagnostics.push(
						mkDiag(
							'I_CONTENT_HINT_ACCEPTED',
							`Document content hint "${proposal.proposalId}" accepted as metadata; no canonical document generated.`,
							'info',
							`proposals.${proposal.proposalId}`,
							'Content hints are input evidence only and do not generate documents.',
						),
					);
					break;
				}
			}

			// Update proposal status
			const isContentHint = proposal.kind === 'document_content_hint';
			updated.proposals[proposalIdx] = {
				...proposal,
				status: 'accepted',
				targetConfirmedRecordId: isContentHint ? undefined : recordId,
				updatedAt: now,
			};

			finalProposal = {
				affectedDocumentIds: [],
				auditEvents: undefined,
				body: updated.proposals[proposalIdx]?.body ?? '',
				caveat: undefined,
				confidence: updated.proposals[proposalIdx]?.confidence,
				createdAt: updated.proposals[proposalIdx]?.createdAt ?? '',
				diagnostics: [],
				evidence: updated.proposals[proposalIdx]?.evidence,
				extractionMetadata: updated.proposals[proposalIdx]?.extractionMetadata
					? {
							operation:
								updated.proposals[proposalIdx]?.extractionMetadata?.operation,
							providerId:
								updated.proposals[proposalIdx]?.extractionMetadata?.providerId,
							providerKind:
								updated.proposals[proposalIdx]?.extractionMetadata
									?.providerKind,
							responseId:
								updated.proposals[proposalIdx]?.extractionMetadata?.responseId,
						}
					: undefined,
				kind: updated.proposals[proposalIdx]?.kind,
				proposalId: updated.proposals[proposalIdx]?.proposalId,
				rejectionReason: undefined,
				revisionHistory: updated.proposals[proposalIdx]?.revisionHistory
					? updated.proposals[proposalIdx]?.revisionHistory?.map((r) => ({
							previousBody: r.previousBody,
							previousTitle: r.previousTitle,
							reason: r.reason,
							revisedAt: r.revisedAt,
						}))
					: undefined,
				source: {
					answerId: updated.proposals[proposalIdx]?.sourceAnswerId,
					documentCanonicalId:
						updated.proposals[proposalIdx]?.sourceDocumentCanonicalId,
					phaseId: updated.proposals[proposalIdx]?.sourcePhaseId,
					questionId: updated.proposals[proposalIdx]?.sourceQuestionId,
					sessionId: updated.proposals[proposalIdx]?.sourceSessionId,
				},
				sourceLabel: undefined,
				sourceTurnId: updated.proposals[proposalIdx]?.sourceTurnId,
				status: 'accepted',
				supersededByProposalId: undefined,
				targetConfirmedRecordId: isContentHint ? undefined : recordId,
				title: updated.proposals[proposalIdx]?.title,
				updatedAt: now,
			};

			return updated;
		},
	});

	changedPaths = result.changedPaths;

	// If updater added diagnostics for not-found, propagate
	const notFoundDiag = diagnostics.find(
		(d) => d.code === 'E_PROPOSAL_NOT_FOUND',
	);
	if (notFoundDiag) {
		return {
			changedPaths,
			diagnostics,
			dryRun: options.dryRun ?? false,
			proposal: undefined,
			proposalId: options.proposalId,
			success: false,
		};
	}

	// If transition was invalid
	const transitionDiag = diagnostics.find(
		(d) => d.code === 'E_INVALID_TRANSITION',
	);
	if (transitionDiag) {
		return {
			changedPaths,
			diagnostics,
			dryRun: options.dryRun ?? false,
			proposal: undefined,
			proposalId: options.proposalId,
			success: false,
		};
	}

	if (!result.success) {
		for (const d of result.diagnostics) {
			diagnostics.push({
				code: `state_${d.code}`,
				message: d.message,
				path: d.path,
				recoveryHint: d.recoveryHint,
				severity: d.severity,
			});
		}
		return {
			changedPaths,
			diagnostics,
			dryRun: options.dryRun ?? false,
			proposal: undefined,
			proposalId: options.proposalId,
			success: false,
		};
	}

	// Read back the final proposal from state if not set by updater
	if (!finalProposal && result.success) {
		const readResult = await readWorkspaceState({
			_fs: options._fs,
			projectRoot: options.projectRoot,
		});
		if (readResult.success && readResult.state) {
			const wp = readResult.state.proposals.find(
				(p) => p.proposalId === options.proposalId,
			);
			if (wp) {
				finalProposal = {
					affectedDocumentIds: [],
					auditEvents: undefined,
					body: wp.body ?? '',
					caveat: undefined,
					confidence: wp.confidence,
					createdAt: wp.createdAt ?? '',
					diagnostics: [],
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
					rejectionReason: undefined,
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
					sourceLabel: undefined,
					sourceTurnId: wp.sourceTurnId,
					status: wp.status,
					supersededByProposalId: undefined,
					targetConfirmedRecordId: wp.targetConfirmedRecordId,
					title: wp.title,
					updatedAt: wp.updatedAt ?? '',
				};
			}
		}
	}

	return {
		changedPaths,
		diagnostics,
		dryRun: options.dryRun ?? false,
		proposal: finalProposal,
		proposalId: options.proposalId,
		success: true,
	};
}

// ---------------------------------------------------------------------------
// Reject
// ---------------------------------------------------------------------------

export async function rejectProposal(
	options: RejectProposalOptions,
): Promise<ProposalLifecycleResult> {
	const diagnostics: ProposalDiagnostic[] = [];
	let finalProposal: ReviewableProposal | undefined;

	const result = await updateWorkspaceState({
		_fs: options._fs,
		_testRandomId: options._testRandomId,
		_testTimestamp: options._testTimestamp,
		dryRun: options.dryRun,
		projectRoot: options.projectRoot,
		updater: (state: WorkspaceState) => {
			const proposalIdx = state.proposals.findIndex(
				(p) => p.proposalId === options.proposalId,
			);
			if (proposalIdx === -1) {
				diagnostics.push(
					mkDiag(
						'E_PROPOSAL_NOT_FOUND',
						`Proposal "${options.proposalId}" not found.`,
					),
				);
				return state;
			}

			const proposal = state.proposals[proposalIdx];
			if (!proposal) return state;
			const currentStatus = proposal.status;

			// Validate transition
			const transitionError = validateTransition(currentStatus, 'reject');
			if (transitionError) {
				diagnostics.push(transitionError);
				return state;
			}

			// Idempotent reject
			if (currentStatus === 'rejected') {
				diagnostics.push(
					mkDiag(
						'W_ALREADY_REJECTED',
						`Proposal "${options.proposalId}" is already rejected.`,
						'warning',
						`proposals.${options.proposalId}`,
						'No action needed.',
					),
				);
				return state;
			}

			const updated = structuredClone(state);
			updated.proposals[proposalIdx] = {
				...proposal,
				rejectionReason: options.reason ?? proposal.rejectionReason,
				status: 'rejected',
				updatedAt: new Date().toISOString(),
			};

			finalProposal = {
				affectedDocumentIds: [],
				auditEvents: undefined,
				body: updated.proposals[proposalIdx]?.body ?? '',
				caveat: undefined,
				confidence: updated.proposals[proposalIdx]?.confidence,
				createdAt: updated.proposals[proposalIdx]?.createdAt ?? '',
				diagnostics: [],
				evidence: updated.proposals[proposalIdx]?.evidence,
				extractionMetadata: updated.proposals[proposalIdx]?.extractionMetadata
					? {
							operation:
								updated.proposals[proposalIdx]?.extractionMetadata?.operation,
							providerId:
								updated.proposals[proposalIdx]?.extractionMetadata?.providerId,
							providerKind:
								updated.proposals[proposalIdx]?.extractionMetadata
									?.providerKind,
							responseId:
								updated.proposals[proposalIdx]?.extractionMetadata?.responseId,
						}
					: undefined,
				kind: updated.proposals[proposalIdx]?.kind,
				proposalId: updated.proposals[proposalIdx]?.proposalId,
				rejectionReason: options.reason,
				revisionHistory: updated.proposals[proposalIdx]?.revisionHistory
					? updated.proposals[proposalIdx]?.revisionHistory?.map((r) => ({
							previousBody: r.previousBody,
							previousTitle: r.previousTitle,
							reason: r.reason,
							revisedAt: r.revisedAt,
						}))
					: undefined,
				source: {
					answerId: updated.proposals[proposalIdx]?.sourceAnswerId,
					documentCanonicalId:
						updated.proposals[proposalIdx]?.sourceDocumentCanonicalId,
					phaseId: updated.proposals[proposalIdx]?.sourcePhaseId,
					questionId: updated.proposals[proposalIdx]?.sourceQuestionId,
					sessionId: updated.proposals[proposalIdx]?.sourceSessionId,
				},
				sourceLabel: undefined,
				sourceTurnId: updated.proposals[proposalIdx]?.sourceTurnId,
				status: 'rejected',
				supersededByProposalId: undefined,
				targetConfirmedRecordId:
					updated.proposals[proposalIdx]?.targetConfirmedRecordId,
				title: updated.proposals[proposalIdx]?.title,
				updatedAt: updated.proposals[proposalIdx]?.updatedAt ?? '',
			};

			return updated;
		},
	});

	if (!result.success) {
		for (const d of result.diagnostics) {
			diagnostics.push({
				code: `state_${d.code}`,
				message: d.message,
				path: d.path,
				recoveryHint: d.recoveryHint,
				severity: d.severity,
			});
		}
	}

	const notFoundDiag = diagnostics.find(
		(d) => d.code === 'E_PROPOSAL_NOT_FOUND',
	);
	if (notFoundDiag) {
		return {
			changedPaths: result.changedPaths,
			diagnostics,
			dryRun: options.dryRun ?? false,
			proposal: undefined,
			proposalId: options.proposalId,
			success: false,
		};
	}

	const transitionDiag = diagnostics.find(
		(d) => d.code === 'E_INVALID_TRANSITION',
	);
	if (transitionDiag) {
		return {
			changedPaths: result.changedPaths,
			diagnostics,
			dryRun: options.dryRun ?? false,
			proposal: undefined,
			proposalId: options.proposalId,
			success: false,
		};
	}

	return {
		changedPaths: result.changedPaths,
		diagnostics,
		dryRun: options.dryRun ?? false,
		proposal: finalProposal,
		proposalId: options.proposalId,
		success: result.success && !notFoundDiag && !transitionDiag,
	};
}

// ---------------------------------------------------------------------------
// Revise
// ---------------------------------------------------------------------------

export async function reviseProposal(
	options: ReviseProposalOptions,
): Promise<ProposalLifecycleResult> {
	const diagnostics: ProposalDiagnostic[] = [];
	const clock = options.clock ?? { now: () => new Date().toISOString() };
	const idFactory =
		options.idFactory ??
		(() => `prop-${Math.random().toString(36).slice(2, 10)}`);
	let finalProposal: ReviewableProposal | undefined;

	const result = await updateWorkspaceState({
		_fs: options._fs,
		_testRandomId: options._testRandomId,
		_testTimestamp: options._testTimestamp,
		dryRun: options.dryRun,
		projectRoot: options.projectRoot,
		updater: (state: WorkspaceState) => {
			const proposalIdx = state.proposals.findIndex(
				(p) => p.proposalId === options.proposalId,
			);
			if (proposalIdx === -1) {
				diagnostics.push(
					mkDiag(
						'E_PROPOSAL_NOT_FOUND',
						`Proposal "${options.proposalId}" not found.`,
					),
				);
				return state;
			}

			const proposal = state.proposals[proposalIdx];
			if (!proposal) return state;
			const currentStatus = proposal.status;

			// Validate transition
			const transitionError = validateTransition(currentStatus, 'revise');
			if (transitionError) {
				diagnostics.push(transitionError);
				return state;
			}

			// Validate revised content
			if (!options.title.trim() && !options.body.trim()) {
				diagnostics.push(
					mkDiag(
						'E_EMPTY_REVISION',
						'Revised proposal must have a non-empty title or body.',
					),
				);
				return state;
			}

			const now = clock.now();
			const revision: ProposalRevision = {
				previousBody: proposal.body ?? '',
				previousTitle: proposal.title,
				reason: options.reason,
				revisedAt: now,
			};

			const revisionHistory = proposal.revisionHistory
				? [...proposal.revisionHistory, revision]
				: [revision];

			const updated = structuredClone(state);

			// Mark old proposal as revised/superseded
			updated.proposals[proposalIdx] = {
				...proposal,
				status: 'revised',
				updatedAt: now,
			};

			// Create new revised proposal
			const newProposalId = idFactory();
			const newProposal: typeof proposal = {
				affectedDocumentIds: proposal.affectedDocumentIds ?? [],
				auditEvents: proposal.auditEvents ?? [],
				body: options.body,
				caveat: proposal.caveat,
				confidence: proposal.confidence,
				createdAt: now,
				diagnostics: proposal.diagnostics ?? [],
				evidence: proposal.evidence,
				extractionMetadata: proposal.extractionMetadata,
				kind: proposal.kind,
				proposalId: newProposalId,
				rejectionReason: undefined,
				revisionHistory,
				sourceAnswerId: proposal.sourceAnswerId,
				sourceDocumentCanonicalId: proposal.sourceDocumentCanonicalId,
				sourceLabel: proposal.sourceLabel,
				sourcePhaseId: proposal.sourcePhaseId,
				sourceQuestionId: proposal.sourceQuestionId,
				sourceSessionId: proposal.sourceSessionId,
				sourceTurnId: proposal.sourceTurnId,
				status: 'proposed',
				supersededByProposalId: undefined,
				targetConfirmedRecordId: undefined,
				title: options.title,
				updatedAt: now,
			};

			updated.proposals = [...updated.proposals, newProposal];

			finalProposal = {
				affectedDocumentIds: [],
				auditEvents: undefined,
				body: options.body,
				caveat: undefined,
				confidence: proposal.confidence,
				createdAt: now,
				diagnostics: [],
				evidence: proposal.evidence,
				extractionMetadata: proposal.extractionMetadata
					? {
							operation: proposal.extractionMetadata.operation,
							providerId: proposal.extractionMetadata.providerId,
							providerKind: proposal.extractionMetadata.providerKind,
							responseId: proposal.extractionMetadata.responseId,
						}
					: undefined,
				kind: proposal.kind,
				proposalId: newProposalId,
				rejectionReason: undefined,
				revisionHistory,
				source: {
					answerId: proposal.sourceAnswerId,
					documentCanonicalId: proposal.sourceDocumentCanonicalId,
					phaseId: proposal.sourcePhaseId,
					questionId: proposal.sourceQuestionId,
					sessionId: proposal.sourceSessionId,
				},
				sourceLabel: undefined,
				sourceTurnId: proposal.sourceTurnId,
				status: 'proposed',
				supersededByProposalId: undefined,
				targetConfirmedRecordId: undefined,
				title: options.title,
				updatedAt: now,
			};

			return updated;
		},
	});

	if (!result.success) {
		for (const d of result.diagnostics) {
			diagnostics.push({
				code: `state_${d.code}`,
				message: d.message,
				path: d.path,
				recoveryHint: d.recoveryHint,
				severity: d.severity,
			});
		}
	}

	const notFoundDiag = diagnostics.find(
		(d) => d.code === 'E_PROPOSAL_NOT_FOUND',
	);
	if (notFoundDiag) {
		return {
			changedPaths: result.changedPaths,
			diagnostics,
			dryRun: options.dryRun ?? false,
			proposal: undefined,
			proposalId: options.proposalId,
			success: false,
		};
	}

	const invalidDiag = diagnostics.find(
		(d) => d.code === 'E_INVALID_TRANSITION' || d.code === 'E_EMPTY_REVISION',
	);
	if (invalidDiag) {
		return {
			changedPaths: result.changedPaths,
			diagnostics,
			dryRun: options.dryRun ?? false,
			proposal: undefined,
			proposalId: options.proposalId,
			success: false,
		};
	}

	return {
		changedPaths: result.changedPaths,
		diagnostics,
		dryRun: options.dryRun ?? false,
		proposal: finalProposal,
		proposalId: finalProposal?.proposalId ?? options.proposalId,
		success: true,
	};
}

// ---------------------------------------------------------------------------
// Defer
// ---------------------------------------------------------------------------

export interface DeferProposalOptions {
	proposalId: string;
	projectRoot: string;
	reason?: string | undefined;
	dryRun?: boolean | undefined;
	clock?: { now(): string } | undefined;
	_fs?: import('../fs/safe-filesystem.js').SafeFsAdapter | undefined;
	_testTimestamp?: string | undefined;
	_testRandomId?: string | undefined;
}

export async function deferProposal(
	options: DeferProposalOptions,
): Promise<ProposalLifecycleResult> {
	const diagnostics: ProposalDiagnostic[] = [];
	const clock = options.clock ?? { now: () => new Date().toISOString() };
	let finalProposal: ReviewableProposal | undefined;

	const result = await updateWorkspaceState({
		_fs: options._fs,
		_testRandomId: options._testRandomId,
		_testTimestamp: options._testTimestamp,
		dryRun: options.dryRun,
		projectRoot: options.projectRoot,
		updater: (state: WorkspaceState) => {
			const proposalIdx = state.proposals.findIndex(
				(p) => p.proposalId === options.proposalId,
			);
			if (proposalIdx === -1) {
				diagnostics.push(
					mkDiag(
						'E_PROPOSAL_NOT_FOUND',
						`Proposal "${options.proposalId}" not found.`,
					),
				);
				return state;
			}

			const proposal = state.proposals[proposalIdx];
			if (!proposal) return state;

			// Only proposed proposals can be deferred
			if (proposal.status !== 'proposed') {
				diagnostics.push(
					mkDiag(
						'E_INVALID_TRANSITION',
						`Cannot defer proposal with status "${proposal.status}"; only "proposed" proposals can be deferred.`,
						'error',
						`proposals.${options.proposalId}`,
					),
				);
				return state;
			}

			const now = clock.now();
			const updated = structuredClone(state);

			// Create audit event
			const auditEvent = {
				actor: 'user',
				changedPaths: [],
				eventId: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
				eventType: 'proposal_deferred',
				sessionRef: proposal.sourceSessionId,
				summary: `Proposal "${options.proposalId}" deferred${options.reason ? `: ${options.reason}` : ''}.`,
				timestamp: now,
			};

			updated.proposals[proposalIdx] = {
				...proposal,
				auditEvents: [...(proposal.auditEvents ?? []), auditEvent],
				status: 'deferred',
				updatedAt: now,
			};

			// Also add to global audit events
			updated.auditEvents = [...updated.auditEvents, auditEvent];

			finalProposal = proposalFromRecord(
				getProposalFromState(updated, options.proposalId) ?? {
					body: updated.proposals[proposalIdx]?.body ?? '',
					confidence: updated.proposals[proposalIdx]?.confidence,
					evidence: updated.proposals[proposalIdx]?.evidence,
					extractionMetadata:
						updated.proposals[proposalIdx]?.extractionMetadata,
					kind: updated.proposals[proposalIdx]?.kind ?? 'decision',
					proposalId: options.proposalId,
					revisionHistory: undefined,
					sourceAnswerId: updated.proposals[proposalIdx]?.sourceAnswerId,
					sourceDocumentCanonicalId:
						updated.proposals[proposalIdx]?.sourceDocumentCanonicalId,
					sourcePhaseId: updated.proposals[proposalIdx]?.sourcePhaseId,
					sourceQuestionId: updated.proposals[proposalIdx]?.sourceQuestionId,
					sourceSessionId: updated.proposals[proposalIdx]?.sourceSessionId,
					status: 'deferred',
					targetConfirmedRecordId:
						updated.proposals[proposalIdx]?.targetConfirmedRecordId,
					title: updated.proposals[proposalIdx]?.title ?? '',
				},
			);

			return updated;
		},
	});

	if (!result.success) {
		for (const d of result.diagnostics) {
			diagnostics.push({
				code: `state_${d.code}`,
				message: d.message,
				path: d.path,
				recoveryHint: d.recoveryHint,
				severity: d.severity,
			});
		}
	}

	const notFoundDiag = diagnostics.find(
		(d) => d.code === 'E_PROPOSAL_NOT_FOUND',
	);
	if (notFoundDiag) {
		return {
			changedPaths: result.changedPaths,
			diagnostics,
			dryRun: options.dryRun ?? false,
			proposal: undefined,
			proposalId: options.proposalId,
			success: false,
		};
	}

	return {
		changedPaths: result.changedPaths,
		diagnostics,
		dryRun: options.dryRun ?? false,
		proposal: finalProposal,
		proposalId: options.proposalId,
		success: true,
	};
}
