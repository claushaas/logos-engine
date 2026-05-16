/** Contextual Suggestion Types — typed contracts for contextual suggestion engine */

import type {
	CanonicalDocumentId,
	PhaseId,
} from '../profiles/documentation-contract.js';

// ---------------------------------------------------------------------------
// Suggestion kind
// ---------------------------------------------------------------------------

export type ContextualSuggestionKind =
	| 'resume_next_question'
	| 'clarify_dependency'
	| 'review_open_question'
	| 'review_proposal'
	| 'address_risk'
	| 'resolve_validation_gap'
	| 'continue_document'
	| 'configure_provider'
	| 'run_status'
	| 'future_command';

// ---------------------------------------------------------------------------
// Suggestion source
// ---------------------------------------------------------------------------

export type ContextualSuggestionSource = 'deterministic' | 'ai_provider';

// ---------------------------------------------------------------------------
// Suggestion reason
// ---------------------------------------------------------------------------

export type ContextualSuggestionReason =
	| 'depends_on_prior_decision'
	| 'depends_on_assumption'
	| 'open_question_blocks_progress'
	| 'pending_proposal_relevant'
	| 'risk_requires_attention'
	| 'validation_gap_present'
	| 'document_incomplete'
	| 'provider_not_configured'
	| 'dependency_unresolved'
	| 'workspace_state_changed';

// ---------------------------------------------------------------------------
// Suggestion status
// ---------------------------------------------------------------------------

export type ContextualSuggestionStatus = 'active' | 'addressed' | 'dismissed';

// ---------------------------------------------------------------------------
// Suggestion diagnostic
// ---------------------------------------------------------------------------

export interface ContextualSuggestionDiagnostic {
	code: string;
	severity: 'error' | 'warning' | 'info';
	message: string;
	recoveryHint: string | undefined;
}

// ---------------------------------------------------------------------------
// Contextual suggestion
// ---------------------------------------------------------------------------

export interface ContextualSuggestion {
	/** Stable suggestion identifier */
	id: string;
	/** Suggestion kind */
	kind: ContextualSuggestionKind;
	/** Short title / summary */
	title: string;
	/** Detailed body text */
	body: string;
	/** Source document canonical ID when relevant */
	sourceDocumentId: CanonicalDocumentId | undefined;
	/** Source phase ID when relevant */
	sourcePhaseId: PhaseId | undefined;
	/** Source question ID when relevant */
	sourceQuestionId: string | undefined;
	/** Related decision ID when relevant */
	relatedDecisionId: string | undefined;
	/** Related assumption ID when relevant */
	relatedAssumptionId: string | undefined;
	/** Related open question ID when relevant */
	relatedOpenQuestionId: string | undefined;
	/** Related risk ID when relevant */
	relatedRiskId: string | undefined;
	/** Related proposal ID when relevant */
	relatedProposalId: string | undefined;
	/** Related run ID when relevant */
	relatedRunId: string | undefined;
	/** Related artifact ID when relevant */
	relatedArtifactId: string | undefined;
	/** Why this suggestion was generated */
	reason: ContextualSuggestionReason;
	/** Confidence level (non-authoritative) */
	confidence: 'low' | 'medium' | 'high' | undefined;
	/** Recommended command if applicable */
	recommendedCommand: string | undefined;
	/** Source of the suggestion */
	source: ContextualSuggestionSource;
	/** Explicit "suggestion only" marker */
	isSuggestionOnly: boolean;
}

// ---------------------------------------------------------------------------
// Suggestion input
// ---------------------------------------------------------------------------

export interface ContextualSuggestionInput {
	/** Workspace state decisions */
	decisions: Array<{
		id: string;
		title: string;
		status: string;
		affectedDocumentIds: string[];
	}>;
	/** Workspace state assumptions */
	assumptions: Array<{
		id: string;
		title: string;
		status: string;
		affectedDocumentIds: string[];
	}>;
	/** Workspace state open questions */
	openQuestions: Array<{
		id: string;
		question: string;
		status: string;
		affectedDocumentIds: string[];
	}>;
	/** Workspace state risks */
	risks: Array<{
		id: string;
		title: string;
		severity: string;
		status: string;
		affectedDocumentIds: string[];
	}>;
	/** Workspace state proposals */
	proposals: Array<{
		proposalId: string;
		kind: string;
		status: string;
		title: string;
		sourceDocumentCanonicalId: string | undefined;
		sourcePhaseId: string | undefined;
		sourceQuestionId: string | undefined;
	}>;
	/** Current question cluster from Step 4.1 */
	plannedQuestions: Array<{
		id: string;
		text: string;
		sourceDocumentId: string;
		sourcePhaseId: string;
		reason: string;
		relatedDependencyId: string | undefined;
		existingOpenQuestionId: string | undefined;
	}>;
	/** Completed document IDs */
	completedDocumentIds: string[];
	/** Config status */
	providerConfigured: boolean;
	/** Validation gaps (from future Phase 6) */
	validationGaps: Array<{
		id: string;
		description: string;
		severity: string;
	}>;
	/** Artifact metadata only */
	artifactMetadata: Array<{
		artifactId: string;
		artifactType: string;
		status: string;
	}>;
	/** Run metadata only */
	runMetadata: Array<{
		runId: string;
		runType: string;
		status: string;
	}>;
	/** Session metadata only */
	sessionMetadata: Array<{
		sessionId: string;
		sessionType: string;
		status: string;
	}>;
}

// ---------------------------------------------------------------------------
// Suggestion result
// ---------------------------------------------------------------------------

export interface ContextualSuggestionResult {
	suggestions: ContextualSuggestion[];
	diagnostics: ContextualSuggestionDiagnostic[];
}

// ---------------------------------------------------------------------------
// Render options
// ---------------------------------------------------------------------------

export interface ContextualSuggestionRenderOptions {
	/** Max suggestions to display */
	maxSuggestions: number;
	/** Show source references */
	showSourceReferences: boolean;
	/** Show recommended commands */
	showRecommendedCommands: boolean;
}

export const DEFAULT_SUGGESTION_RENDER_OPTIONS: ContextualSuggestionRenderOptions =
	{
		maxSuggestions: 5,
		showRecommendedCommands: true,
		showSourceReferences: false,
	};
