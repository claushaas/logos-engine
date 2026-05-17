/** Contextual Suggestions — deterministic suggestion engine */

import type {
	CanonicalDocumentId,
	PhaseId,
} from '../profiles/documentation-contract.js';
import { redactString } from '../runtime/redaction.js';
import type {
	ContextualSuggestion,
	ContextualSuggestionDiagnostic,
	ContextualSuggestionInput,
	ContextualSuggestionKind,
	ContextualSuggestionReason,
	ContextualSuggestionResult,
} from './contextual-suggestion-types.js';

// ---------------------------------------------------------------------------
// Suggestion ID counter
// ---------------------------------------------------------------------------

let _suggestionCounter = 0;

function nextSuggestionId(): string {
	_suggestionCounter += 1;
	return `sug-${String(_suggestionCounter).padStart(4, '0')}`;
}

/** Reset counter for deterministic tests */
export function resetSuggestionCounter(): void {
	_suggestionCounter = 0;
}

// ---------------------------------------------------------------------------
// Secret pattern detection for embedded secrets in strings
// ---------------------------------------------------------------------------

const SECRET_SUBSTRING_PATTERNS = [
	/\bsk-[a-zA-Z0-9_-]{10,}\b/g,
	/\bgsk_[a-zA-Z0-9]{10,}\b/g,
	/\bhf_[a-zA-Z0-9]{10,}\b/g,
	/\bBearer\s+[a-zA-Z0-9\-_.~+/=]{20,}\b/gi,
	/\beyJ[a-zA-Z0-9_\-.]{8,}\b/g,
	/\b(ghp|gho|ghu|ghs|ghr|xoxb|xoxp|dapi|sl)[a-zA-Z0-9_-]{10,}\b/g,
];

function redactEmbeddedSecrets(value: string): string {
	let result = value;
	for (const pattern of SECRET_SUBSTRING_PATTERNS) {
		result = result.replace(pattern, '[REDACTED]');
	}
	return redactString(result);
}

function truncateRedacted(value: string, maxLength: number): string {
	return redactEmbeddedSecrets(value).slice(0, maxLength);
}

// ---------------------------------------------------------------------------
// Generate contextual suggestions
// ---------------------------------------------------------------------------

export function generateContextualSuggestions(
	input: ContextualSuggestionInput,
): ContextualSuggestionResult {
	const diagnostics: ContextualSuggestionDiagnostic[] = [];
	const suggestions: ContextualSuggestion[] = [];

	// 1. Suggestions for planned questions that depend on prior decisions
	suggestions.push(...suggestDependentQuestionClarifications(input));

	// 2. Suggestions for unresolved open questions blocking progress
	suggestions.push(...suggestOpenQuestionReview(input));

	// 3. Suggestions for pending proposals
	suggestions.push(...suggestProposalReview(input));

	// 4. Suggestions for risks requiring attention
	suggestions.push(...suggestRiskAddressal(input));

	// 5. Suggestions for validation gaps
	suggestions.push(...suggestValidationGapResolution(input));

	// 6. Suggestions for incomplete documents
	suggestions.push(...suggestDocumentContinuation(input));

	// 7. Provider configuration suggestion
	if (!input.providerConfigured) {
		suggestions.push({
			body: `AI provider is not configured. Set up a provider to enable AI-assisted intake, suggestions, and diagnostics.`,
			confidence: 'high',
			id: nextSuggestionId(),
			isSuggestionOnly: true,
			kind: 'configure_provider' as ContextualSuggestionKind,
			reason: 'provider_not_configured' as ContextualSuggestionReason,
			recommendedCommand: '/config ai',
			relatedArtifactId: undefined,
			relatedAssumptionId: undefined,
			relatedDecisionId: undefined,
			relatedOpenQuestionId: undefined,
			relatedProposalId: undefined,
			relatedRiskId: undefined,
			relatedRunId: undefined,
			source: 'deterministic',
			sourceDocumentId: undefined,
			sourcePhaseId: undefined,
			sourceQuestionId: undefined,
			title: 'Configure AI provider',
		});
	}

	// 8. Workspace state changed suggestion (if sessions/artifacts exist)
	if (input.sessionMetadata.length > 0 || input.artifactMetadata.length > 0) {
		// Don't treat artifact/run/session metadata as canonical truth
		suggestions.push({
			body: `Your workspace has session and artifact history. Run /status to review the current state.`,
			confidence: 'low',
			id: nextSuggestionId(),
			isSuggestionOnly: true,
			kind: 'run_status' as ContextualSuggestionKind,
			reason: 'workspace_state_changed' as ContextualSuggestionReason,
			recommendedCommand: '/status',
			relatedArtifactId: undefined,
			relatedAssumptionId: undefined,
			relatedDecisionId: undefined,
			relatedOpenQuestionId: undefined,
			relatedProposalId: undefined,
			relatedRiskId: undefined,
			relatedRunId: undefined,
			source: 'deterministic',
			sourceDocumentId: undefined,
			sourcePhaseId: undefined,
			sourceQuestionId: undefined,
			title: 'Review workspace status',
		});
	}

	// Deduplicate by title
	const seenTitles = new Set<string>();
	const uniqueSuggestions: ContextualSuggestion[] = [];
	for (const s of suggestions) {
		const key = s.title;
		if (!seenTitles.has(key)) {
			seenTitles.add(key);
			uniqueSuggestions.push(s);
		}
	}

	return { diagnostics, suggestions: uniqueSuggestions };
}

// ---------------------------------------------------------------------------
// 1. Dependent question clarifications
// ---------------------------------------------------------------------------

function suggestDependentQuestionClarifications(
	input: ContextualSuggestionInput,
): ContextualSuggestion[] {
	const suggestions: ContextualSuggestion[] = [];

	for (const q of input.plannedQuestions) {
		// Check if question relates to a prior decision
		const relatedDecision = input.decisions.find(
			(d) =>
				d.status === 'confirmed' &&
				(d.affectedDocumentIds.includes(q.sourceDocumentId) ||
					d.affectedDocumentIds.length === 0),
		);

		if (relatedDecision) {
			suggestions.push({
				body: `The question "${redactEmbeddedSecrets(q.text)}" may depend on the confirmed decision "${redactEmbeddedSecrets(relatedDecision.title)}". Consider reviewing this decision before answering.`,
				confidence: 'medium',
				id: nextSuggestionId(),
				isSuggestionOnly: true,
				kind: 'clarify_dependency' as ContextualSuggestionKind,
				reason: 'depends_on_prior_decision' as ContextualSuggestionReason,
				recommendedCommand: '/continue',
				relatedArtifactId: undefined,
				relatedAssumptionId: undefined,
				relatedDecisionId: relatedDecision.id,
				relatedOpenQuestionId: undefined,
				relatedProposalId: undefined,
				relatedRiskId: undefined,
				relatedRunId: undefined,
				source: 'deterministic',
				sourceDocumentId: q.sourceDocumentId as CanonicalDocumentId,
				sourcePhaseId: q.sourcePhaseId as PhaseId,
				sourceQuestionId: q.id,
				title: `Review prior decision for: ${truncateRedacted(q.text, 60)}`,
			});
		}

		// Check if question relates to an assumption
		const relatedAssumption = input.assumptions.find(
			(a) =>
				a.status === 'active' &&
				(a.affectedDocumentIds.includes(q.sourceDocumentId) ||
					a.affectedDocumentIds.length === 0),
		);

		if (relatedAssumption && !relatedDecision) {
			suggestions.push({
				body: `The question "${redactEmbeddedSecrets(q.text)}" may depend on assumption "${redactEmbeddedSecrets(relatedAssumption.title)}". Verify this assumption is still valid.`,
				confidence: 'medium',
				id: nextSuggestionId(),
				isSuggestionOnly: true,
				kind: 'clarify_dependency' as ContextualSuggestionKind,
				reason: 'depends_on_assumption' as ContextualSuggestionReason,
				recommendedCommand: '/continue',
				relatedArtifactId: undefined,
				relatedAssumptionId: relatedAssumption.id,
				relatedDecisionId: undefined,
				relatedOpenQuestionId: undefined,
				relatedProposalId: undefined,
				relatedRiskId: undefined,
				relatedRunId: undefined,
				source: 'deterministic',
				sourceDocumentId: q.sourceDocumentId as CanonicalDocumentId,
				sourcePhaseId: q.sourcePhaseId as PhaseId,
				sourceQuestionId: q.id,
				title: `Verify assumption for: ${truncateRedacted(q.text, 60)}`,
			});
		}
	}

	return suggestions;
}

// ---------------------------------------------------------------------------
// 2. Open question review
// ---------------------------------------------------------------------------

function suggestOpenQuestionReview(
	input: ContextualSuggestionInput,
): ContextualSuggestion[] {
	const suggestions: ContextualSuggestion[] = [];

	const openQList = input.openQuestions.filter((q) => q.status === 'open');
	if (openQList.length === 0) return suggestions;

	// Check if any planned questions reference existing open questions
	for (const q of input.plannedQuestions) {
		if (q.existingOpenQuestionId) {
			const existing = openQList.find(
				(oq) => oq.id === q.existingOpenQuestionId,
			);
			if (existing) {
				suggestions.push({
					body: `The question "${redactEmbeddedSecrets(q.text)}" was preserved from existing open question "${redactEmbeddedSecrets(existing.question)}". This question may block progress on document ${q.sourceDocumentId}.`,
					confidence: 'high',
					id: nextSuggestionId(),
					isSuggestionOnly: true,
					kind: 'review_open_question' as ContextualSuggestionKind,
					reason: 'open_question_blocks_progress' as ContextualSuggestionReason,
					recommendedCommand: '/continue',
					relatedArtifactId: undefined,
					relatedAssumptionId: undefined,
					relatedDecisionId: undefined,
					relatedOpenQuestionId: existing.id,
					relatedProposalId: undefined,
					relatedRiskId: undefined,
					relatedRunId: undefined,
					source: 'deterministic',
					sourceDocumentId: q.sourceDocumentId as CanonicalDocumentId,
					sourcePhaseId: q.sourcePhaseId as PhaseId,
					sourceQuestionId: q.id,
					title: `Unresolved open question: ${truncateRedacted(existing.question, 60)}`,
				});
			}
		}
	}

	// If we have open questions not yet linked to planned questions
	if (suggestions.length === 0 && openQList.length > 0) {
		const first = openQList[0];
		if (!first) return suggestions;
		suggestions.push({
			body: `You have ${openQList.length} open question(s) that need attention. The oldest open question is: "${redactEmbeddedSecrets(first.question)}". Address open questions to unblock progress.`,
			confidence: 'high',
			id: nextSuggestionId(),
			isSuggestionOnly: true,
			kind: 'review_open_question' as ContextualSuggestionKind,
			reason: 'open_question_blocks_progress' as ContextualSuggestionReason,
			recommendedCommand: '/continue',
			relatedArtifactId: undefined,
			relatedAssumptionId: undefined,
			relatedDecisionId: undefined,
			relatedOpenQuestionId: first.id,
			relatedProposalId: undefined,
			relatedRiskId: undefined,
			relatedRunId: undefined,
			source: 'deterministic',
			sourceDocumentId: undefined,
			sourcePhaseId: undefined,
			sourceQuestionId: undefined,
			title: `${openQList.length} open question(s) need attention`,
		});
	}

	return suggestions;
}

// ---------------------------------------------------------------------------
// 3. Proposal review
// ---------------------------------------------------------------------------

function suggestProposalReview(
	input: ContextualSuggestionInput,
): ContextualSuggestion[] {
	const suggestions: ContextualSuggestion[] = [];

	const pendingProposals = input.proposals.filter(
		(p) => p.status === 'proposed',
	);
	if (pendingProposals.length === 0) return suggestions;

	// Check if any pending proposals relate to planned questions
	for (const q of input.plannedQuestions) {
		const relatedProposal = pendingProposals.find(
			(p) =>
				p.sourceDocumentCanonicalId === q.sourceDocumentId ||
				p.sourceQuestionId === q.id,
		);

		if (relatedProposal) {
			suggestions.push({
				body: `Proposal "${redactEmbeddedSecrets(relatedProposal.title)}" (${relatedProposal.kind}) is pending review and relates to the planned question "${redactEmbeddedSecrets(q.text)}". Review this proposal before continuing — it is a suggestion, not a confirmed decision.`,
				confidence: 'high',
				id: nextSuggestionId(),
				isSuggestionOnly: true,
				kind: 'review_proposal' as ContextualSuggestionKind,
				reason: 'pending_proposal_relevant' as ContextualSuggestionReason,
				recommendedCommand: '/continue',
				relatedArtifactId: undefined,
				relatedAssumptionId: undefined,
				relatedDecisionId: undefined,
				relatedOpenQuestionId: undefined,
				relatedProposalId: relatedProposal.proposalId,
				relatedRiskId: undefined,
				relatedRunId: undefined,
				source: 'deterministic',
				sourceDocumentId: (relatedProposal.sourceDocumentCanonicalId ??
					undefined) as CanonicalDocumentId | undefined,
				sourcePhaseId: (relatedProposal.sourcePhaseId ?? undefined) as
					| PhaseId
					| undefined,
				sourceQuestionId: q.id,
				title: `Review pending proposal: ${truncateRedacted(relatedProposal.title, 60)}`,
			});
		}
	}

	// If no specific proposal-question link, suggest reviewing pending proposals generally
	if (suggestions.length === 0 && pendingProposals.length > 0) {
		const first = pendingProposals[0];
		if (!first) return suggestions;
		suggestions.push({
			body: `You have ${pendingProposals.length} pending proposal(s) that require explicit review. Proposals are suggestions, not confirmed facts. Example: "${redactEmbeddedSecrets(first.title)}" (${first.kind}). Use /continue to review.`,
			confidence: 'high',
			id: nextSuggestionId(),
			isSuggestionOnly: true,
			kind: 'review_proposal' as ContextualSuggestionKind,
			reason: 'pending_proposal_relevant' as ContextualSuggestionReason,
			recommendedCommand: '/continue',
			relatedArtifactId: undefined,
			relatedAssumptionId: undefined,
			relatedDecisionId: undefined,
			relatedOpenQuestionId: undefined,
			relatedProposalId: first.proposalId,
			relatedRiskId: undefined,
			relatedRunId: undefined,
			source: 'deterministic',
			sourceDocumentId: (first.sourceDocumentCanonicalId ?? undefined) as
				| CanonicalDocumentId
				| undefined,
			sourcePhaseId: (first.sourcePhaseId ?? undefined) as PhaseId | undefined,
			sourceQuestionId: undefined,
			title: `${pendingProposals.length} pending proposal(s) to review`,
		});
	}

	return suggestions;
}

// ---------------------------------------------------------------------------
// 4. Risk addressal
// ---------------------------------------------------------------------------

function suggestRiskAddressal(
	input: ContextualSuggestionInput,
): ContextualSuggestion[] {
	const suggestions: ContextualSuggestion[] = [];

	const activeRisks = input.risks.filter(
		(r) => r.status === 'identified' || r.status === 'monitored',
	);
	if (activeRisks.length === 0) return suggestions;

	// Check if any planned questions relate to documents with active risks
	for (const q of input.plannedQuestions) {
		const relatedRisk = activeRisks.find(
			(r) =>
				r.affectedDocumentIds.includes(q.sourceDocumentId) ||
				r.affectedDocumentIds.length === 0,
		);

		if (relatedRisk) {
			suggestions.push({
				body: `Document ${q.sourceDocumentId} has an active risk: "${redactEmbeddedSecrets(relatedRisk.title)}" (${relatedRisk.severity}). Consider addressing this risk before advancing.`,
				confidence: 'medium',
				id: nextSuggestionId(),
				isSuggestionOnly: true,
				kind: 'address_risk' as ContextualSuggestionKind,
				reason: 'risk_requires_attention' as ContextualSuggestionReason,
				recommendedCommand: '/continue',
				relatedArtifactId: undefined,
				relatedAssumptionId: undefined,
				relatedDecisionId: undefined,
				relatedOpenQuestionId: undefined,
				relatedProposalId: undefined,
				relatedRiskId: relatedRisk.id,
				relatedRunId: undefined,
				source: 'deterministic',
				sourceDocumentId: q.sourceDocumentId as CanonicalDocumentId,
				sourcePhaseId: q.sourcePhaseId as PhaseId,
				sourceQuestionId: q.id,
				title: `Risk: ${truncateRedacted(relatedRisk.title, 60)}`,
			});
		}
	}

	// If we haven't generated a specific risk suggestion, give a general one
	if (suggestions.length === 0 && activeRisks.length > 0) {
		suggestions.push({
			body: `You have ${activeRisks.length} active risk(s) that may require attention before continuing. Run /status to review.`,
			confidence: 'low',
			id: nextSuggestionId(),
			isSuggestionOnly: true,
			kind: 'address_risk' as ContextualSuggestionKind,
			reason: 'risk_requires_attention' as ContextualSuggestionReason,
			recommendedCommand: '/status',
			relatedArtifactId: undefined,
			relatedAssumptionId: undefined,
			relatedDecisionId: undefined,
			relatedOpenQuestionId: undefined,
			relatedProposalId: undefined,
			relatedRiskId: undefined,
			relatedRunId: undefined,
			source: 'deterministic',
			sourceDocumentId: undefined,
			sourcePhaseId: undefined,
			sourceQuestionId: undefined,
			title: `${activeRisks.length} active risk(s) to review`,
		});
	}

	return suggestions;
}

// ---------------------------------------------------------------------------
// 5. Validation gap resolution
// ---------------------------------------------------------------------------

function suggestValidationGapResolution(
	input: ContextualSuggestionInput,
): ContextualSuggestion[] {
	const suggestions: ContextualSuggestion[] = [];

	if (input.validationGaps.length === 0) return suggestions;

	for (const gap of input.validationGaps.slice(0, 3)) {
		suggestions.push({
			body: `Validation gap detected: "${redactEmbeddedSecrets(gap.description)}" (${gap.severity}). This gap must be resolved by user action — it will not be fixed automatically.`,
			confidence: 'high',
			id: nextSuggestionId(),
			isSuggestionOnly: true,
			kind: 'resolve_validation_gap' as ContextualSuggestionKind,
			reason: 'validation_gap_present' as ContextualSuggestionReason,
			recommendedCommand: '/diagnose',
			relatedArtifactId: undefined,
			relatedAssumptionId: undefined,
			relatedDecisionId: undefined,
			relatedOpenQuestionId: undefined,
			relatedProposalId: undefined,
			relatedRiskId: undefined,
			relatedRunId: undefined,
			source: 'deterministic',
			sourceDocumentId: undefined,
			sourcePhaseId: undefined,
			sourceQuestionId: undefined,
			title: `Validation gap: ${truncateRedacted(gap.description, 60)}`,
		});
	}

	return suggestions;
}

// ---------------------------------------------------------------------------
// 6. Document continuation
// ---------------------------------------------------------------------------

function suggestDocumentContinuation(
	input: ContextualSuggestionInput,
): ContextualSuggestion[] {
	const suggestions: ContextualSuggestion[] = [];

	// Count incomplete documents (those with planned questions but not in completed list)
	const incompleteDocuments = new Set(
		input.plannedQuestions
			.filter((q) => !input.completedDocumentIds.includes(q.sourceDocumentId))
			.map((q) => q.sourceDocumentId),
	);

	if (incompleteDocuments.size > 0) {
		suggestions.push({
			body: `${incompleteDocuments.size} document(s) have planned questions and are not yet complete. Consider continuing intake to progress these documents.`,
			confidence: 'medium',
			id: nextSuggestionId(),
			isSuggestionOnly: true,
			kind: 'continue_document' as ContextualSuggestionKind,
			reason: 'document_incomplete' as ContextualSuggestionReason,
			recommendedCommand: '/continue',
			relatedArtifactId: undefined,
			relatedAssumptionId: undefined,
			relatedDecisionId: undefined,
			relatedOpenQuestionId: undefined,
			relatedProposalId: undefined,
			relatedRiskId: undefined,
			relatedRunId: undefined,
			source: 'deterministic',
			sourceDocumentId: undefined,
			sourcePhaseId: undefined,
			sourceQuestionId: undefined,
			title: `${incompleteDocuments.size} document(s) not yet complete`,
		});
	}

	return suggestions;
}
