/** Deterministic Intake Interpreter — rule-based classification of user text into proposals */

import type { ReviewableProposal } from './proposal-types.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type IntakeInterpretationSource =
	| 'deterministic'
	| 'ai-provider'
	| 'none';

export interface DeterministicInterpretationInput {
	text: string;
	sessionId: string;
	turnId: string;
	clock?: { now(): string };
	idFactory?: () => string;
}

export interface DeterministicInterpretationResult {
	proposals: ReviewableProposal[];
	diagnostics: IntakeInterpretationDiagnostic[];
}

export interface IntakeInterpretationDiagnostic {
	code: string;
	severity: 'error' | 'warning' | 'info';
	message: string;
	recoveryHint?: string | undefined;
}

// ---------------------------------------------------------------------------
// Language detection helpers
// ---------------------------------------------------------------------------

const UNKNOWN_PATTERNS = [
	/\bi don'?t know\b/i,
	/\bunknown\b/i,
	/\bunsure\b/i,
	/\bnot sure\b/i,
	/\bno idea\b/i,
	/\bcouldn'?t say\b/i,
	/\bnot certain\b/i,
	/\bi have no\b/i,
	/\bno clue\b/i,
	/\bn[aã]o sei\b/i,
	/\bn[aã]o tenho certeza\b/i,
	/\bdesconhe[cç]o\b/i,
];

const ASSUME_PATTERNS = [
	/\bassume for now\b/i,
	/\bassuma por enquanto\b/i,
	/\bpor ora podemos considerar\b/i,
	/\bfor now,? assume\b/i,
	/\blet's? assume\b/i,
	/\btemporarily assume\b/i,
	/\bworking assumption\b/i,
	/\bassume that\b/i,
	/\bassumindo que\b/i,
	/\bconsiderando que\b/i,
	/\bvamos assumir\b/i,
	/\btake as given\b/i,
];

const DECISION_PATTERNS = [
	/\bwe (will|decide|choose|select|resolve)\b/i,
	/\b(the )?decision is\b/i,
	/\bi'?ve decided\b/i,
	/\bdecided (that|to)\b/i,
	/\bconcluded that\b/i,
	/\bresolved to\b/i,
	/\bgoing with\b/i,
	/\bchoosing\b/i,
	/\bdecidimos?\b/i,
	/\b(pick|picked|chose|chosen)\b/i,
];

const RISK_PATTERNS = [
	/\b(risk|risks|risky)\b/i,
	/\b(threat|threats|threatening)\b/i,
	/\b(vulnerab|vulnerabilities?)\b/i,
	/\b(worst case|worst-case)\b/i,
	/\b(failure mode|failure modes)\b/i,
	/\b(concern|concerns|concerning)\b/i,
	/\b(could go wrong|might fail)\b/i,
	/\b(danger|dangerous)\b/i,
	/\briscos?\b/i,
	/\bperigos?\b/i,
];

const QUESTION_PATTERNS = [
	/^(what|how|why|when|who|where|which|can|should|is|are|do|does|will|could|would|did|has|have|may|might|shall)\b/i,
	/\b(wonder|wondering|questioning|question)\b/i,
	/\?/,
];

const LOW_CONFIDENCE_PATTERNS = [
	/\b(maybe|perhaps|possibly|probably|likely|unlikely)\b/i,
	/\b(guess|speculate|speculation|roughly)\b/i,
	/\b(not entirely sure|ballpark|estimate)\b/i,
	/\bi think maybe\b/i,
	/\btalvez\b/i,
	/\bprovavelmente\b/i,
];

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

function defaultClock(): { now(): string } {
	return { now: () => new Date().toISOString() };
}

function defaultIdFactory(): () => string {
	return () =>
		`prop-det-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function extractFirstSentence(text: string): string {
	const sentenceMatch = text.match(/^[^.!?]+[.!?]?/);
	return sentenceMatch
		? sentenceMatch[0].trim()
		: text.substring(0, 100).trim();
}

function detectConfidence(text: string): ReviewableProposal['confidence'] {
	for (const pattern of LOW_CONFIDENCE_PATTERNS) {
		if (pattern.test(text)) return 'low';
	}
	return undefined;
}

export function interpretIntakeText(
	input: DeterministicInterpretationInput,
): DeterministicInterpretationResult {
	const clock = input.clock ?? defaultClock();
	const idFactory = input.idFactory ?? defaultIdFactory();
	const now = clock.now();
	const proposals: ReviewableProposal[] = [];
	const diagnostics: IntakeInterpretationDiagnostic[] = [];

	const trimmed = input.text.trim();
	if (!trimmed) {
		diagnostics.push({
			code: 'LOGOS_INTAKE_EMPTY_INPUT',
			message: 'Empty intake input; no proposals created.',
			recoveryHint: 'Provide some text to interpret.',
			severity: 'info',
		});
		return { diagnostics, proposals };
	}

	const confidence = detectConfidence(trimmed);

	// 1. Check for explicit unknown answer
	for (const pattern of UNKNOWN_PATTERNS) {
		if (pattern.test(trimmed)) {
			const title = extractFirstSentence(trimmed) || 'Unknown answer';
			proposals.push({
				affectedDocumentIds: [],
				auditEvents: undefined,
				body: trimmed,
				caveat: 'User indicated this is unknown.',
				confidence: confidence ?? 'low',
				createdAt: now,
				diagnostics: [
					{
						code: 'LOGOS_DETERMINISTIC_UNKNOWN_ANSWER',
						message: 'User answer classified as unknown.',
						severity: 'info',
					},
				],
				evidence: trimmed.substring(0, 200),
				extractionMetadata: undefined,
				kind: 'open_question',
				proposalId: idFactory(),
				rejectionReason: undefined,
				revisionHistory: undefined,
				source: {
					answerId: input.turnId,
					documentCanonicalId: undefined,
					phaseId: undefined,
					questionId: undefined,
					sessionId: input.sessionId,
				},
				sourceLabel: 'deterministic',
				sourceTurnId: input.turnId,
				status: 'proposed',
				supersededByProposalId: undefined,
				targetConfirmedRecordId: undefined,
				title: `[Open Question] ${title}`,
				updatedAt: now,
			});
			diagnostics.push({
				code: 'LOGOS_INTAKE_UNKNOWN_ANSWER_DETECTED',
				message: 'Unknown answer detected; open question proposal created.',
				recoveryHint:
					'Accept this as an open question, or replace it with an answer later.',
				severity: 'info',
			});
			return { diagnostics, proposals };
		}
	}

	// 2. Check for assume-for-now
	for (const pattern of ASSUME_PATTERNS) {
		if (pattern.test(trimmed)) {
			const title = extractFirstSentence(trimmed) || 'Assumption';
			proposals.push({
				affectedDocumentIds: [],
				auditEvents: undefined,
				body: trimmed,
				caveat:
					'This is a temporary assumption. Treat as working hypothesis until validated.',
				confidence: confidence ?? 'low',
				createdAt: now,
				diagnostics: [
					{
						code: 'LOGOS_DETERMINISTIC_ASSUMPTION',
						message: 'User answer classified as an assumption.',
						severity: 'info',
					},
				],
				evidence: trimmed.substring(0, 200),
				extractionMetadata: undefined,
				kind: 'assumption',
				proposalId: idFactory(),
				rejectionReason: undefined,
				revisionHistory: undefined,
				source: {
					answerId: input.turnId,
					documentCanonicalId: undefined,
					phaseId: undefined,
					questionId: undefined,
					sessionId: input.sessionId,
				},
				sourceLabel: 'deterministic',
				sourceTurnId: input.turnId,
				status: 'proposed',
				supersededByProposalId: undefined,
				targetConfirmedRecordId: undefined,
				title: `[Assumption] ${title}`,
				updatedAt: now,
			});
			diagnostics.push({
				code: 'LOGOS_INTAKE_ASSUMPTION_DETECTED',
				message:
					'Assume-for-now language detected; assumption proposal created.',
				recoveryHint:
					'Review and accept this assumption or convert it to an open question when ready.',
				severity: 'info',
			});
			return { diagnostics, proposals };
		}
	}

	// 3. Check for explicit decision language
	for (const pattern of DECISION_PATTERNS) {
		if (pattern.test(trimmed)) {
			const title = extractFirstSentence(trimmed) || 'User-sourced decision';
			proposals.push({
				affectedDocumentIds: [],
				auditEvents: undefined,
				body: trimmed,
				caveat: undefined,
				confidence: confidence ?? 'medium',
				createdAt: now,
				diagnostics: [
					{
						code: 'LOGOS_DETERMINISTIC_DECISION',
						message: 'User answer classified as a decision.',
						severity: 'info',
					},
				],
				evidence: trimmed.substring(0, 200),
				extractionMetadata: undefined,
				kind: 'decision',
				proposalId: idFactory(),
				rejectionReason: undefined,
				revisionHistory: undefined,
				source: {
					answerId: input.turnId,
					documentCanonicalId: undefined,
					phaseId: undefined,
					questionId: undefined,
					sessionId: input.sessionId,
				},
				sourceLabel: 'deterministic',
				sourceTurnId: input.turnId,
				status: 'proposed',
				supersededByProposalId: undefined,
				targetConfirmedRecordId: undefined,
				title: `[Decision] ${title}`,
				updatedAt: now,
			});
			diagnostics.push({
				code: 'LOGOS_INTAKE_DECISION_DETECTED',
				message:
					'Explicit decision language detected; decision proposal created.',
				recoveryHint:
					'Review the proposal and accept, revise, reject, or defer it.',
				severity: 'info',
			});
			return { diagnostics, proposals };
		}
	}

	// 4. Check for explicit risk language
	for (const pattern of RISK_PATTERNS) {
		if (pattern.test(trimmed)) {
			const title = extractFirstSentence(trimmed) || 'User-sourced risk';
			proposals.push({
				affectedDocumentIds: [],
				auditEvents: undefined,
				body: trimmed,
				caveat: undefined,
				confidence: confidence ?? 'medium',
				createdAt: now,
				diagnostics: [
					{
						code: 'LOGOS_DETERMINISTIC_RISK',
						message: 'User answer classified as a risk.',
						severity: 'info',
					},
				],
				evidence: trimmed.substring(0, 200),
				extractionMetadata: undefined,
				kind: 'risk',
				proposalId: idFactory(),
				rejectionReason: undefined,
				revisionHistory: undefined,
				source: {
					answerId: input.turnId,
					documentCanonicalId: undefined,
					phaseId: undefined,
					questionId: undefined,
					sessionId: input.sessionId,
				},
				sourceLabel: 'deterministic',
				sourceTurnId: input.turnId,
				status: 'proposed',
				supersededByProposalId: undefined,
				targetConfirmedRecordId: undefined,
				title: `[Risk] ${title}`,
				updatedAt: now,
			});
			diagnostics.push({
				code: 'LOGOS_INTAKE_RISK_DETECTED',
				message: 'Explicit risk language detected; risk proposal created.',
				recoveryHint:
					'Review the proposal and accept, revise, reject, or defer it.',
				severity: 'info',
			});
			return { diagnostics, proposals };
		}
	}

	// 5. Check for question-like input
	for (const pattern of QUESTION_PATTERNS) {
		if (pattern.test(trimmed)) {
			const title = extractFirstSentence(trimmed) || 'Open question';
			proposals.push({
				affectedDocumentIds: [],
				auditEvents: undefined,
				body: trimmed,
				caveat: undefined,
				confidence: undefined,
				createdAt: now,
				diagnostics: [
					{
						code: 'LOGOS_DETERMINISTIC_QUESTION',
						message: 'User input classified as an open question.',
						severity: 'info',
					},
				],
				evidence: trimmed.substring(0, 200),
				extractionMetadata: undefined,
				kind: 'open_question',
				proposalId: idFactory(),
				rejectionReason: undefined,
				revisionHistory: undefined,
				source: {
					answerId: input.turnId,
					documentCanonicalId: undefined,
					phaseId: undefined,
					questionId: undefined,
					sessionId: input.sessionId,
				},
				sourceLabel: 'deterministic',
				sourceTurnId: input.turnId,
				status: 'proposed',
				supersededByProposalId: undefined,
				targetConfirmedRecordId: undefined,
				title: `[Open Question] ${title}`,
				updatedAt: now,
			});
			diagnostics.push({
				code: 'LOGOS_INTAKE_QUESTION_DETECTED',
				message:
					'Question-like input detected; open question proposal created.',
				recoveryHint:
					'Answer the question to create a decision, assumption, or risk proposal.',
				severity: 'info',
			});
			return { diagnostics, proposals };
		}
	}

	// 6. Fallback — create a review-required open question for ambiguous prose
	{
		const title = extractFirstSentence(trimmed) || 'User input (needs review)';
		proposals.push({
			affectedDocumentIds: [],
			auditEvents: undefined,
			body: trimmed,
			caveat:
				'Deterministic interpreter could not classify this input. Review required.',
			confidence: 'low',
			createdAt: now,
			diagnostics: [
				{
					code: 'LOGOS_DETERMINISTIC_AMBIGUOUS',
					message:
						'Input could not be deterministically classified; open question created for review.',
					severity: 'info',
				},
			],
			evidence: trimmed.substring(0, 200),
			extractionMetadata: undefined,
			kind: 'open_question',
			proposalId: idFactory(),
			rejectionReason: undefined,
			revisionHistory: undefined,
			source: {
				answerId: input.turnId,
				documentCanonicalId: undefined,
				phaseId: undefined,
				questionId: undefined,
				sessionId: input.sessionId,
			},
			sourceLabel: 'deterministic',
			sourceTurnId: input.turnId,
			status: 'proposed',
			supersededByProposalId: undefined,
			targetConfirmedRecordId: undefined,
			title: `[Review required] ${title}`,
			updatedAt: now,
		});
		diagnostics.push({
			code: 'LOGOS_INTAKE_FALLBACK_USED',
			message:
				'Ambiguous input; fallback open question proposal created. Review required.',
			recoveryHint:
				'Review the proposal and accept, revise, or reject. Provide more explicit input next time to get automatic classification.',
			severity: 'warning',
		});
		return { diagnostics, proposals };
	}
}
