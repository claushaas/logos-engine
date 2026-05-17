/** Proposal Mapper — maps user answers and validated AI extraction to reviewable proposals */

import type {
	CanonicalDocumentId,
	PhaseId,
} from '../profiles/documentation-contract.js';
import { redactString } from '../runtime/redaction.js';
import type {
	ProposalDiagnostic,
	ProposalKind,
	ProposalMappingInput,
	ProposalMappingResult,
	ProposalSource,
	ReviewableProposal,
} from './proposal-types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const RECORD_TYPE_KIND_MAP: Record<string, ProposalKind> = {
	assumption: 'assumption',
	assumptions: 'assumption',
	content_hint: 'document_content_hint',
	decision: 'decision',
	decisions: 'decision',
	document_content_hint: 'document_content_hint',
	hypotheses: 'hypothesis',
	hypothesis: 'hypothesis',
	open_question: 'open_question',
	open_questions: 'open_question',
	question: 'open_question',
	questions: 'open_question',
	risk: 'risk',
	risks: 'risk',
};

function mapRecordTypeToKind(recordType: string): ProposalKind | undefined {
	const lower = recordType.toLowerCase().trim();
	return RECORD_TYPE_KIND_MAP[lower];
}

function normalizeText(value: unknown): string {
	if (typeof value === 'string') return value.trim();
	if (typeof value === 'number' || typeof value === 'boolean')
		return String(value);
	return '';
}

function redactProposalText(value: string): string {
	return redactString(value).trim();
}

function extractTextFromFields(fields: Record<string, unknown>): {
	title: string;
	body: string;
} {
	const title =
		normalizeText(fields.title) ||
		normalizeText(fields.summary) ||
		normalizeText(fields.name) ||
		normalizeText(fields.label) ||
		'';
	const body =
		normalizeText(fields.body) ||
		normalizeText(fields.description) ||
		normalizeText(fields.content) ||
		normalizeText(fields.text) ||
		normalizeText(fields.detail) ||
		'';
	return { body, title };
}

function buildSource(
	input: ProposalMappingInput,
	questionId?: string,
	documentCanonicalId?: CanonicalDocumentId,
	phaseId?: PhaseId,
): ProposalSource {
	return {
		answerId: input.answers[0]?.answerId,
		documentCanonicalId,
		phaseId,
		questionId,
		sessionId: input.sessionId,
	};
}

function extractSourceFromQuestionCluster(
	input: ProposalMappingInput,
	questionId: string | undefined,
): {
	documentCanonicalId: CanonicalDocumentId | undefined;
	phaseId: PhaseId | undefined;
} {
	if (!questionId || !input.questionCluster)
		return { documentCanonicalId: undefined, phaseId: undefined };
	const q = input.questionCluster.questions.find((cq) => cq.id === questionId);
	if (!q) return { documentCanonicalId: undefined, phaseId: undefined };
	return {
		documentCanonicalId: q.source.documentCanonicalId,
		phaseId: q.source.phaseId,
	};
}

function makeId(input: ProposalMappingInput): string {
	if (input.idFactory) return input.idFactory();
	return `prop-${Math.random().toString(36).slice(2, 10)}`;
}

function now(input: ProposalMappingInput): string {
	if (input.clock) return input.clock.now();
	return new Date().toISOString();
}

// ---------------------------------------------------------------------------
// Map user answers to proposals
// ---------------------------------------------------------------------------

function mapAnswerToProposals(
	input: ProposalMappingInput,
	answer: ProposalMappingInput['answers'][number],
	allDiagnostics: ProposalDiagnostic[],
): ReviewableProposal[] {
	const proposals: ReviewableProposal[] = [];
	const timestamp = now(input);
	const source = buildSource(input, answer.questionId);
	const questionClusterSource = extractSourceFromQuestionCluster(
		input,
		answer.questionId,
	);

	source.documentCanonicalId = questionClusterSource.documentCanonicalId;
	source.phaseId = questionClusterSource.phaseId;

	const normalizedAnswer = redactProposalText(answer.answer);

	if (!normalizedAnswer) {
		allDiagnostics.push({
			code: 'E_EMPTY_ANSWER',
			message: `Answer "${answer.answerId}" is empty; cannot map to proposals.`,
			path: `answers.${answer.answerId}`,
			recoveryHint: 'Provide a non-empty answer to generate proposals.',
			severity: 'warning',
		});
		return proposals;
	}

	// Heuristic: extract potential decision-like content
	if (
		/decide|decision|choose|select|resolve|conclude|we will|we'll|the decision|final/i.test(
			normalizedAnswer,
		)
	) {
		proposals.push({
			body: normalizedAnswer,
			confidence: undefined,
			createdAt: timestamp,
			evidence: normalizedAnswer.substring(0, 200),
			extractionMetadata: input.providerMetadata,
			kind: 'decision',
			proposalId: makeId(input),
			rejectionReason: undefined,
			revisionHistory: undefined,
			source,
			status: 'proposed',
			supersededByProposalId: undefined,
			targetConfirmedRecordId: undefined,
			title: extractFirstSentence(normalizedAnswer) || 'User-sourced decision',
			updatedAt: timestamp,
		});
	}

	// Heuristic: extract potential assumption-like content
	if (
		/assume|assuming|we assume|given that|presume|presuming/i.test(
			normalizedAnswer,
		)
	) {
		proposals.push({
			body: normalizedAnswer,
			confidence: undefined,
			createdAt: timestamp,
			evidence: normalizedAnswer.substring(0, 200),
			extractionMetadata: input.providerMetadata,
			kind: 'assumption',
			proposalId: makeId(input),
			rejectionReason: undefined,
			revisionHistory: undefined,
			source,
			status: 'proposed',
			supersededByProposalId: undefined,
			targetConfirmedRecordId: undefined,
			title:
				extractFirstSentence(normalizedAnswer) || 'User-sourced assumption',
			updatedAt: timestamp,
		});
	}

	// Heuristic: extract potential hypothesis-like content
	if (
		/hypothes|maybe|perhaps|might|could|possibly|what if|speculat/i.test(
			normalizedAnswer,
		)
	) {
		proposals.push({
			body: normalizedAnswer,
			confidence: undefined,
			createdAt: timestamp,
			evidence: normalizedAnswer.substring(0, 200),
			extractionMetadata: input.providerMetadata,
			kind: 'hypothesis',
			proposalId: makeId(input),
			rejectionReason: undefined,
			revisionHistory: undefined,
			source,
			status: 'proposed',
			supersededByProposalId: undefined,
			targetConfirmedRecordId: undefined,
			title:
				extractFirstSentence(normalizedAnswer) || 'User-sourced hypothesis',
			updatedAt: timestamp,
		});
	}

	// Heuristic: extract potential question-like content
	if (
		/^what|^how|^why|^when|^who|^where|^which|^can|^should|^is|^are|^do|^does\b/i.test(
			normalizedAnswer,
		)
	) {
		proposals.push({
			body: normalizedAnswer,
			confidence: undefined,
			createdAt: timestamp,
			evidence: normalizedAnswer.substring(0, 200),
			extractionMetadata: input.providerMetadata,
			kind: 'open_question',
			proposalId: makeId(input),
			rejectionReason: undefined,
			revisionHistory: undefined,
			source,
			status: 'proposed',
			supersededByProposalId: undefined,
			targetConfirmedRecordId: undefined,
			title:
				extractFirstSentence(normalizedAnswer) || 'User-sourced open question',
			updatedAt: timestamp,
		});
	}

	// Heuristic: extract potential risk-like content
	if (
		/risk|danger|threat|vulnerab|worst case|failure mode|concern/i.test(
			normalizedAnswer,
		)
	) {
		proposals.push({
			body: normalizedAnswer,
			confidence: undefined,
			createdAt: timestamp,
			evidence: normalizedAnswer.substring(0, 200),
			extractionMetadata: input.providerMetadata,
			kind: 'risk',
			proposalId: makeId(input),
			rejectionReason: undefined,
			revisionHistory: undefined,
			source,
			status: 'proposed',
			supersededByProposalId: undefined,
			targetConfirmedRecordId: undefined,
			title: extractFirstSentence(normalizedAnswer) || 'User-sourced risk',
			updatedAt: timestamp,
		});
	}

	// Heuristic: potential document content hint
	if (
		/write|document|content|section|paragraph|describe|summary|outline|draft/i.test(
			normalizedAnswer,
		)
	) {
		proposals.push({
			body: normalizedAnswer,
			confidence: undefined,
			createdAt: timestamp,
			evidence: normalizedAnswer.substring(0, 200),
			extractionMetadata: input.providerMetadata,
			kind: 'document_content_hint',
			proposalId: makeId(input),
			rejectionReason: undefined,
			revisionHistory: undefined,
			source,
			status: 'proposed',
			supersededByProposalId: undefined,
			targetConfirmedRecordId: undefined,
			title:
				extractFirstSentence(normalizedAnswer) ||
				'User-sourced document content hint',
			updatedAt: timestamp,
		});
	}

	// Fallback: if nothing matched, make a simple assumption
	if (proposals.length === 0) {
		proposals.push({
			body: normalizedAnswer,
			confidence: undefined,
			createdAt: timestamp,
			evidence: normalizedAnswer.substring(0, 200),
			extractionMetadata: input.providerMetadata,
			kind: 'assumption',
			proposalId: makeId(input),
			rejectionReason: undefined,
			revisionHistory: undefined,
			source,
			status: 'proposed',
			supersededByProposalId: undefined,
			targetConfirmedRecordId: undefined,
			title: extractFirstSentence(normalizedAnswer) || 'User-sourced input',
			updatedAt: timestamp,
		});
	}

	return proposals;
}

// ---------------------------------------------------------------------------
// Map validated AI extractions to proposals
// ---------------------------------------------------------------------------

function mapExtractionsToProposals(
	input: ProposalMappingInput,
	allDiagnostics: ProposalDiagnostic[],
	unmappableItems: ProposalDiagnostic[],
): ReviewableProposal[] {
	const proposals: ReviewableProposal[] = [];
	if (!input.validatedExtractions || input.validatedExtractions.length === 0)
		return proposals;

	const timestamp = now(input);
	const source = buildSource(input);

	for (const record of input.validatedExtractions) {
		if (!record.isProposed) {
			unmappableItems.push({
				code: 'E_EXTRACTION_NOT_PROPOSED',
				message: `Extraction record "${record.recordId}" is not marked as proposed.`,
				path: `extractions.${record.recordId}`,
				recoveryHint: 'Only proposed records may be mapped.',
				severity: 'error',
			});
			continue;
		}

		const kind = mapRecordTypeToKind(record.recordType);
		if (!kind) {
			unmappableItems.push({
				code: 'E_UNKNOWN_RECORD_TYPE',
				message: `Extraction record "${record.recordId}" has unrecognised recordType "${record.recordType}".`,
				path: `extractions.${record.recordId}.recordType`,
				recoveryHint: `Supported types: ${Object.keys(RECORD_TYPE_KIND_MAP).join(', ')}`,
				severity: 'warning',
			});
			continue;
		}

		const extracted = extractTextFromFields(record.fields);
		const title = redactProposalText(extracted.title);
		const body = redactProposalText(extracted.body);
		if (!title && !body) {
			unmappableItems.push({
				code: 'E_EMPTY_EXTRACTION',
				message: `Extraction record "${record.recordId}" has no usable title or body.`,
				path: `extractions.${record.recordId}`,
				recoveryHint: 'The extraction fields must include a title or body.',
				severity: 'warning',
			});
			continue;
		}

		// Check for duplicate proposals for the same extraction
		const duplicateKey = `${record.recordId}:${kind}`;
		const isDuplicate = proposals.some(
			(p) =>
				`${p.extractionMetadata?.responseId ?? ''}:${p.kind}` === duplicateKey,
		);
		if (isDuplicate) {
			allDiagnostics.push({
				code: 'W_DUPLICATE_EXTRACTION',
				message: `Duplicate extraction "${record.recordId}" of kind "${kind}" skipped.`,
				path: `extractions.${record.recordId}`,
				recoveryHint: 'Each extraction should produce one proposal.',
				severity: 'info',
			});
			continue;
		}

		proposals.push({
			body,
			confidence: record.confidence,
			createdAt: timestamp,
			evidence: body.substring(0, 200) || title,
			extractionMetadata: input.providerMetadata ?? {
				operation: undefined,
				providerId: undefined,
				providerKind: undefined,
				responseId: record.recordId,
			},
			kind,
			proposalId: makeId(input),
			rejectionReason: undefined,
			revisionHistory: undefined,
			source,
			status: 'proposed',
			supersededByProposalId: undefined,
			targetConfirmedRecordId: undefined,
			title: title || 'Untitled extraction',
			updatedAt: timestamp,
		});
	}

	return proposals;
}

// ---------------------------------------------------------------------------
// Primary mapping function
// ---------------------------------------------------------------------------

export function mapAnswersToProposals(
	input: ProposalMappingInput,
): ProposalMappingResult {
	const diagnostics: ProposalDiagnostic[] = [];
	const unmappableItems: ProposalDiagnostic[] = [];

	// Validate input — must have answers or validated extractions
	const hasAnswers = input.answers && input.answers.length > 0;
	const hasExtractions =
		input.validatedExtractions && input.validatedExtractions.length > 0;
	if (!hasAnswers && !hasExtractions) {
		diagnostics.push({
			code: 'E_NO_ANSWERS',
			message: 'No answers or extractions provided for proposal mapping.',
			path: 'answers',
			recoveryHint:
				'Provide at least one answer or extraction to map to proposals.',
			severity: 'error',
		});
		return {
			diagnostics,
			proposals: [],
			success: false,
			unmappableItems,
		};
	}

	const allProposals: ReviewableProposal[] = [];

	// Map each user answer
	for (const answer of input.answers) {
		allProposals.push(...mapAnswerToProposals(input, answer, diagnostics));
	}

	// Map validated extractions
	allProposals.push(
		...mapExtractionsToProposals(input, diagnostics, unmappableItems),
	);

	return {
		diagnostics,
		proposals: allProposals,
		success: diagnostics.every((d) => d.severity !== 'error'),
		unmappableItems,
	};
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractFirstSentence(text: string): string {
	const trimmed = text.trim();
	if (!trimmed) return '';
	const match = /^(.+?[.!?])(?:\s|$)/.exec(trimmed);
	if (match?.[1]) return match[1].substring(0, 120);
	return trimmed.substring(0, 120);
}
