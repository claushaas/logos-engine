/** Provider Request Builders — build structured AI provider requests from intake context */

import type {
	ConversationMessage,
	ConversationOperationRequest,
	StartupBriefingRequest,
	StructuredExtractionRequest,
	SuggestionRequest,
} from '../ai/provider-port.js';
import type { IntakeContext } from './intake-context-types.js';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function buildContextCategorySummary(
	context: IntakeContext,
): Record<string, number> {
	return {
		answers: context.answers.length,
		artifact_metadata: context.artifactMetadata.length,
		assumptions: context.assumptions.length,
		decisions: context.decisions.length,
		documents: context.documents.length,
		open_questions: context.openQuestions.length,
		profile: 1,
		question_cluster: context.questionCluster ? 1 : 0,
		recent_runs: context.recentRuns.length,
		recent_sessions: context.recentSessions.length,
		risks: context.risks.length,
		validation_gaps: context.validationGaps.length,
	};
}

// ---------------------------------------------------------------------------
// Conversation request
// ---------------------------------------------------------------------------

export interface BuildConversationRequestOptions {
	systemPrompt?: string | undefined;
	userQuery?: string | undefined;
}

export function buildConversationRequest(
	context: IntakeContext,
	options: BuildConversationRequestOptions = {},
): ConversationOperationRequest {
	const messages: ConversationMessage[] = [];

	const summary = buildContextCategorySummary(context);

	const systemPrompt =
		options.systemPrompt ??
		`You are a documentation intake assistant. You help users make decisions and fill gaps in their documentation profile.

Context provided:
- Profile: ${context.profile.profileId} (source: ${context.profile.profileSource ?? 'unknown'})
- ${context.documents.length} document(s) in scope
- ${context.decisions.length} relevant confirmed/proposed decision(s)
- ${context.assumptions.length} active assumption(s)
- ${context.openQuestions.length} open question(s)
- ${context.risks.length} identified/monitored risk(s)
- ${context.validationGaps.length} validation gap(s)`;

	messages.push({ content: systemPrompt, role: 'system' });

	for (const doc of context.documents) {
		messages.push({
			content: `Document: ${doc.title} (${doc.canonicalId}) — Phase: ${doc.phaseTitle ?? doc.phaseId}, Status: ${doc.status}`,
			role: 'system',
		});
	}

	if (context.questionCluster) {
		messages.push({
			content: `Active question cluster: ${context.questionCluster.reasonSummary}. ${context.questionCluster.questions.length} questions planned.`,
			role: 'system',
		});
	}

	if (options.userQuery) {
		messages.push({ content: options.userQuery, role: 'user' });
	} else {
		messages.push({
			content:
				'Please help me work through the current documentation status and remaining questions.',
			role: 'user',
		});
	}

	return {
		contextCategorySummary: summary,
		executionMode: 'inline',
		messages,
		operation: 'conversation',
		providerId: undefined,
		providerKind: 'fake',
	};
}

// ---------------------------------------------------------------------------
// Structured extraction request
// ---------------------------------------------------------------------------

export interface BuildStructuredExtractionRequestOptions {
	schemaDescription?: string | undefined;
}

export function buildStructuredExtractionRequest(
	context: IntakeContext,
	options: BuildStructuredExtractionRequestOptions = {},
): StructuredExtractionRequest {
	const summary = buildContextCategorySummary(context);

	return {
		context: context as unknown as Record<string, unknown>,
		contextCategorySummary: summary,
		executionMode: 'inline',
		operation: 'structured_extraction',
		providerId: undefined,
		providerKind: 'fake',
		schemaDescription:
			options.schemaDescription ??
			'Extract decisions, assumptions, and risks from the provided context',
	};
}

// ---------------------------------------------------------------------------
// Suggestion request
// ---------------------------------------------------------------------------

export interface BuildSuggestionRequestOptions {
	prompt?: string | undefined;
}

export function buildSuggestionRequest(
	context: IntakeContext,
	options: BuildSuggestionRequestOptions = {},
): SuggestionRequest {
	const summary = buildContextCategorySummary(context);

	const prompt =
		options.prompt ??
		`Given the current documentation state for profile "${context.profile.profileId}" with ${context.openQuestions.length} open question(s), suggest the next actions to take.`;

	return {
		context: context as unknown as Record<string, unknown>,
		contextCategorySummary: summary,
		executionMode: 'inline',
		operation: 'suggestion',
		prompt,
		providerId: undefined,
		providerKind: 'fake',
	};
}

// ---------------------------------------------------------------------------
// Startup briefing request
// ---------------------------------------------------------------------------

export function buildStartupBriefingRequest(
	context: IntakeContext,
): StartupBriefingRequest {
	const summary = buildContextCategorySummary(context);

	return {
		context: context as unknown as Record<string, unknown>,
		contextCategorySummary: summary,
		executionMode: 'inline',
		operation: 'startup_briefing',
		providerId: undefined,
		providerKind: 'fake',
	};
}
