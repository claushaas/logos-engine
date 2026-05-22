/**
 * LOGOS Core — Intake completeness calculation (Step 6.1).
 *
 * Computes generation-readiness inputs from the active profile question
 * registry and durable intake state.  This module calculates the structured
 * completeness model that later preflight logic will use; it does *not*
 * decide final generation readiness.
 *
 * Rules:
 * - Pure function: no filesystem, no profile resolution, no state mutation.
 * - No AI / provider calls.
 * - No Pi types.
 * - Deterministic output for the same input.
 * - Does not throw for normal missing-answer cases.
 * - Returns warnings for inconsistent state where useful.
 *
 * Boundary: must not import Pi, Ink, React, TUI, or CLI modules.
 */

import type { LogosQuestionRegistry } from '../questions/question-registry.js';
import type { LogosQuestion } from '../questions/question-types.js';
import type {
	IntakeAnswerRecord,
	LogosIntakeState,
} from '../state/intake-state-types.js';

// ---------------------------------------------------------------------------
// Completeness types
// ---------------------------------------------------------------------------

/**
 * Per-question completeness status derived from registry metadata and
 * persisted intake records.
 */
export type QuestionCompletenessStatus =
	| 'sufficient'
	| 'partial'
	| 'missing'
	| 'contradictory'
	| 'skipped';

/**
 * Completeness information for a single question.
 *
 * `completenessScore` is in the range [0, 1] and is deterministic.
 * `blocking` is `true` when the question must be resolved before final
 * generation can proceed (the actual gate is applied later by preflight).
 * `generationCritical` is `true` when the question is both required and
 * has priority `critical`.
 */
export type QuestionCompleteness = {
	questionId: string;
	phaseId: string;
	documentId: string;
	sectionId: string;
	required: boolean;
	priority: 'critical' | 'important' | 'optional';
	status: QuestionCompletenessStatus;
	completenessScore: number;
	blocking: boolean;
	generationCritical: boolean;
	missingAspects: string[];
	contradictionIds: string[];
	answeredAt?: string;
	updatedAt?: string;
	skippedAt?: string;
	metadata?: Record<string, unknown>;
};

/**
 * Aggregate completeness for all questions in a single phase.
 *
 * All counts are non-negative integers.
 * `completenessScore` is the phase-scoped score in [0, 1].
 */
export type PhaseCompleteness = {
	phaseId: string;
	total: number;
	sufficient: number;
	partial: number;
	missing: number;
	contradictory: number;
	skipped: number;
	requiredTotal: number;
	requiredSufficient: number;
	criticalTotal: number;
	criticalSufficient: number;
	completenessScore: number;
	blockingQuestionIds: string[];
	missingCriticalQuestionIds: string[];
	partialCriticalQuestionIds: string[];
	contradictoryQuestionIds: string[];
};

/**
 * Top-level completeness model for the entire intake.
 *
 * `byQuestion` includes every question in the registry.
 * `byPhase` includes every phase represented in the registry.
 * `completenessScore` is in [0, 1].
 */
export type IntakeCompleteness = {
	total: number;
	sufficient: number;
	partial: number;
	missing: number;
	contradictory: number;
	skipped: number;
	requiredTotal: number;
	requiredSufficient: number;
	criticalTotal: number;
	criticalSufficient: number;
	completenessScore: number;
	byQuestion: Record<string, QuestionCompleteness>;
	byPhase: Record<string, PhaseCompleteness>;
	blockingQuestionIds: string[];
	missingCriticalQuestionIds: string[];
	partialCriticalQuestionIds: string[];
	contradictoryQuestionIds: string[];
	skippedRequiredQuestionIds: string[];
	warnings: string[];
};

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

export type CalculateIntakeCompletenessInput = {
	/** The active profile's question registry (all questions). */
	registry: LogosQuestionRegistry;
	/** Current durable intake state. */
	intakeState: LogosIntakeState;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Check whether a question is "generation-critical":
 * required === true AND priority === 'critical'.
 */
function isGenerationCritical(question: LogosQuestion): boolean {
	return question.required && question.priority === 'critical';
}

/**
 * Find all unresolved contradiction ids tied to the given question.
 */
function findUnresolvedContradictionIds(
	questionId: string,
	intakeState: LogosIntakeState,
): string[] {
	const ids: string[] = [];
	for (const contradiction of Object.values(intakeState.contradictions)) {
		if (
			contradiction.questionId === questionId &&
			contradiction.status === 'unresolved'
		) {
			ids.push(contradiction.id);
		}
	}
	return ids;
}

/**
 * Clamp a value to the [0, 1] range.
 */
function clamp01(value: number): number {
	if (value < 0) return 0;
	if (value > 1) return 1;
	return value;
}

/**
 * Compute a deterministic completeness score from individual question scores.
 * Returns 0 when `total` is 0.
 */
function computeAggregateScore(
	questionScores: Iterable<number>,
	total: number,
): number {
	if (total === 0) return 0;
	let sum = 0;
	for (const score of questionScores) {
		sum += clamp01(score);
	}
	return sum / total;
}

// ---------------------------------------------------------------------------
// Per-question status derivation
// ---------------------------------------------------------------------------

/**
 * Derive {@link QuestionCompleteness} for a single question.
 *
 * The status-check order matches the specification:
 * 1. Contradictory — any unresolved contradiction.
 * 2. Sufficient  — answer record with "sufficient" status.
 * 3. Partial     — partial record OR answer record with non-sufficient status.
 * 4. Skipped     — skipped record AND question is optional (required→partial).
 * 5. Missing     — no records.
 */
function deriveQuestionCompleteness(
	question: LogosQuestion,
	intakeState: LogosIntakeState,
	warnings: string[],
): QuestionCompleteness {
	const questionId = question.id;

	// --- 1. Contradictory ---
	const contradictionIds = findUnresolvedContradictionIds(
		questionId,
		intakeState,
	);
	if (contradictionIds.length > 0) {
		return {
			blocking: true,
			completenessScore: 0,
			contradictionIds,
			documentId: question.documentId,
			generationCritical: isGenerationCritical(question),
			missingAspects: [],
			phaseId: question.phaseId,
			priority: question.priority,
			questionId,
			required: question.required,
			sectionId: question.sectionId,
			status: 'contradictory',
		};
	}

	// --- 2. Sufficient ---
	const answerRecord: IntakeAnswerRecord | undefined =
		intakeState.answeredQuestions[questionId];
	if (answerRecord !== undefined && answerRecord.status === 'sufficient') {
		const qc: QuestionCompleteness = {
			answeredAt: answerRecord.answeredAt,
			blocking: false,
			completenessScore: 1,
			contradictionIds: [],
			documentId: question.documentId,
			generationCritical: isGenerationCritical(question),
			missingAspects: [],
			phaseId: question.phaseId,
			priority: question.priority,
			questionId,
			required: question.required,
			sectionId: question.sectionId,
			status: 'sufficient',
			updatedAt: answerRecord.revisedAt ?? answerRecord.answeredAt,
		};
		if (answerRecord.metadata !== undefined) {
			qc.metadata = answerRecord.metadata;
		}
		return qc;
	}

	// --- 3. Partial ---
	const partialRecord = intakeState.partialQuestions[questionId];

	// Non-sufficient answer statuses: partial, insufficient, contradictory, needs_clarification.
	if (answerRecord !== undefined) {
		// Existing answer record with non-sufficient status.
		let score: number;

		// Use evaluation completeness score if available in metadata.
		if (
			answerRecord.metadata !== undefined &&
			typeof answerRecord.metadata.completenessScore === 'number'
		) {
			score = clamp01(answerRecord.metadata.completenessScore);
		} else if (answerRecord.status === 'partial') {
			score = 0.5;
		} else {
			// insufficient, needs_clarification, contradictory (in answer record
			// but NOT as an unresolved contradiction — that was caught above).
			score = 0.25;
		}

		// If the answer status is 'contradictory' in the record but no
		// unresolved contradiction exists (resolved or never created properly),
		// treat as partial with a warning.
		if (answerRecord.status === 'contradictory') {
			warnings.push(
				`Question "${questionId}" has answer status "contradictory" but no unresolved contradiction record. Treating as partial.`,
			);
		}

		const critical = isGenerationCritical(question);

		const partialQc: QuestionCompleteness = {
			answeredAt: answerRecord.answeredAt,
			blocking: question.required || critical,
			completenessScore: score,
			contradictionIds: [],
			documentId: question.documentId,
			generationCritical: critical,
			missingAspects:
				partialRecord?.missingAspects ??
				getMissingAspectsFromMetadata(answerRecord.metadata),
			phaseId: question.phaseId,
			priority: question.priority,
			questionId,
			required: question.required,
			sectionId: question.sectionId,
			status: 'partial',
			updatedAt: answerRecord.revisedAt ?? answerRecord.answeredAt,
		};
		if (answerRecord.metadata !== undefined) {
			partialQc.metadata = answerRecord.metadata;
		}
		return partialQc;
	}

	if (partialRecord !== undefined) {
		const critical = isGenerationCritical(question);
		const partialOnlyQc: QuestionCompleteness = {
			blocking: question.required || critical,
			completenessScore: 0.5,
			contradictionIds: [],
			documentId: question.documentId,
			generationCritical: critical,
			missingAspects: partialRecord.missingAspects,
			phaseId: question.phaseId,
			priority: question.priority,
			questionId,
			required: question.required,
			sectionId: question.sectionId,
			status: 'partial',
			updatedAt: partialRecord.updatedAt ?? partialRecord.recordedAt,
		};
		if (partialRecord.metadata !== undefined) {
			partialOnlyQc.metadata = partialRecord.metadata;
		}
		return partialOnlyQc;
	}

	// --- 4. Skipped ---
	const skippedRecord = intakeState.skippedQuestions[questionId];
	if (skippedRecord !== undefined) {
		if (question.required) {
			// Required question was skipped → treat as partial (blocking).
			// The spec says: skipped required → status should be partial, not harmless skipped.
			const critical = isGenerationCritical(question);
			const reqSkippedQc: QuestionCompleteness = {
				blocking: true,
				completenessScore: 0,
				contradictionIds: [],
				documentId: question.documentId,
				generationCritical: critical,
				missingAspects: [skippedRecord.reason],
				phaseId: question.phaseId,
				priority: question.priority,
				questionId,
				required: true,
				sectionId: question.sectionId,
				skippedAt: skippedRecord.skippedAt,
				status: 'partial',
			};
			if (skippedRecord.metadata !== undefined) {
				reqSkippedQc.metadata = skippedRecord.metadata;
			}
			return reqSkippedQc;
		}

		// Optional skipped → not blocking.
		const optSkippedQc: QuestionCompleteness = {
			blocking: false,
			completenessScore: 1,
			contradictionIds: [],
			documentId: question.documentId,
			generationCritical: false,
			missingAspects: [],
			phaseId: question.phaseId,
			priority: question.priority,
			questionId,
			required: false,
			sectionId: question.sectionId,
			skippedAt: skippedRecord.skippedAt,
			status: 'skipped',
		};
		if (skippedRecord.metadata !== undefined) {
			optSkippedQc.metadata = skippedRecord.metadata;
		}
		return optSkippedQc;
	}

	// --- 5. Missing ---
	const critical = isGenerationCritical(question);
	return {
		blocking: question.required || critical,
		completenessScore: 0,
		contradictionIds: [],
		documentId: question.documentId,
		generationCritical: critical,
		missingAspects: [],
		phaseId: question.phaseId,
		priority: question.priority,
		questionId,
		required: question.required,
		sectionId: question.sectionId,
		status: 'missing',
	};
}

/**
 * Extract missingAspects from an answer record's metadata if present.
 */
function getMissingAspectsFromMetadata(
	metadata: Record<string, unknown> | undefined,
): string[] {
	if (metadata === undefined) return [];
	const raw = metadata.missingAspects;
	if (Array.isArray(raw) && raw.every((v) => typeof v === 'string')) {
		return raw as string[];
	}
	return [];
}

// ---------------------------------------------------------------------------
// Phase aggregation
// ---------------------------------------------------------------------------

function aggregatePhaseCompleteness(
	phaseId: string,
	questions: QuestionCompleteness[],
): PhaseCompleteness {
	let total = 0;
	let sufficient = 0;
	let partial = 0;
	let missing = 0;
	let contradictory = 0;
	let skipped = 0;
	let requiredTotal = 0;
	let requiredSufficient = 0;
	let criticalTotal = 0;
	let criticalSufficient = 0;
	const blockingQuestionIds: string[] = [];
	const missingCriticalQuestionIds: string[] = [];
	const partialCriticalQuestionIds: string[] = [];
	const contradictoryQuestionIds: string[] = [];
	const scores: number[] = [];

	for (const qc of questions) {
		total++;
		scores.push(qc.completenessScore);

		switch (qc.status) {
			case 'sufficient':
				sufficient++;
				break;
			case 'partial':
				partial++;
				break;
			case 'missing':
				missing++;
				break;
			case 'contradictory':
				contradictory++;
				break;
			case 'skipped':
				skipped++;
				break;
		}

		if (qc.required) {
			requiredTotal++;
			if (qc.status === 'sufficient') {
				requiredSufficient++;
			}
		}

		if (qc.generationCritical) {
			criticalTotal++;
			if (qc.status === 'sufficient') {
				criticalSufficient++;
			}
		}

		if (qc.blocking) {
			blockingQuestionIds.push(qc.questionId);
		}

		if (qc.generationCritical && qc.status === 'missing') {
			missingCriticalQuestionIds.push(qc.questionId);
		}
		if (qc.generationCritical && qc.status === 'partial') {
			partialCriticalQuestionIds.push(qc.questionId);
		}
		if (qc.status === 'contradictory') {
			contradictoryQuestionIds.push(qc.questionId);
		}
	}

	return {
		blockingQuestionIds,
		completenessScore: computeAggregateScore(scores, total),
		contradictory,
		contradictoryQuestionIds,
		criticalSufficient,
		criticalTotal,
		missing,
		missingCriticalQuestionIds,
		partial,
		partialCriticalQuestionIds,
		phaseId,
		requiredSufficient,
		requiredTotal,
		skipped,
		sufficient,
		total,
	};
}

// ---------------------------------------------------------------------------
// Main calculation
// ---------------------------------------------------------------------------

/**
 * Calculate intake completeness from the active profile question registry
 * and durable intake state.
 *
 * This is a pure function.  It does not mutate its inputs, read the
 * filesystem, resolve profiles, or call external services.
 *
 * The returned {@link IntakeCompleteness} model is structured for later
 * generation preflight logic to consume — it does not directly decide
 * whether generation should be allowed.
 *
 * @returns A deterministic completeness model.  Warnings are included for
 *          inconsistent state (e.g., registry questions with invalid ids,
 *          empty registry).
 */
export function calculateIntakeCompleteness(
	input: CalculateIntakeCompletenessInput,
): IntakeCompleteness {
	const { registry, intakeState } = input;
	const warnings: string[] = [];

	// --- Guard: empty registry ---
	if (registry.questions.length === 0) {
		warnings.push('question_registry_empty');
		return {
			blockingQuestionIds: [],
			byPhase: {},
			byQuestion: {},
			completenessScore: 0,
			contradictory: 0,
			contradictoryQuestionIds: [],
			criticalSufficient: 0,
			criticalTotal: 0,
			missing: 0,
			missingCriticalQuestionIds: [],
			partial: 0,
			partialCriticalQuestionIds: [],
			requiredSufficient: 0,
			requiredTotal: 0,
			skipped: 0,
			skippedRequiredQuestionIds: [],
			sufficient: 0,
			total: 0,
			warnings,
		};
	}

	// --- Per-question completeness ---
	const byQuestion: Record<string, QuestionCompleteness> = {};
	const byPhaseGroups: Record<string, QuestionCompleteness[]> = {};

	for (const question of registry.questions) {
		const qc = deriveQuestionCompleteness(question, intakeState, warnings);
		byQuestion[question.id] = qc;

		let group = byPhaseGroups[question.phaseId];
		if (group === undefined) {
			group = [];
			byPhaseGroups[question.phaseId] = group;
		}
		group.push(qc);
	}

	// --- Aggregate counts ---
	let total = 0;
	let sufficient = 0;
	let partial = 0;
	let missing = 0;
	let contradictory = 0;
	let skipped = 0;
	let requiredTotal = 0;
	let requiredSufficient = 0;
	let criticalTotal = 0;
	let criticalSufficient = 0;
	const blockingQuestionIds: string[] = [];
	const missingCriticalQuestionIds: string[] = [];
	const partialCriticalQuestionIds: string[] = [];
	const contradictoryQuestionIds: string[] = [];
	const skippedRequiredQuestionIds: string[] = [];
	const allScores: number[] = [];

	for (const qc of Object.values(byQuestion)) {
		total++;
		allScores.push(qc.completenessScore);

		switch (qc.status) {
			case 'sufficient':
				sufficient++;
				break;
			case 'partial':
				partial++;
				break;
			case 'missing':
				missing++;
				break;
			case 'contradictory':
				contradictory++;
				break;
			case 'skipped':
				skipped++;
				break;
		}

		if (qc.required) {
			requiredTotal++;
			if (qc.status === 'sufficient') requiredSufficient++;
		}
		if (qc.generationCritical) {
			criticalTotal++;
			if (qc.status === 'sufficient') criticalSufficient++;
		}
		if (qc.blocking) {
			blockingQuestionIds.push(qc.questionId);
		}
		if (qc.status === 'missing' && qc.generationCritical) {
			missingCriticalQuestionIds.push(qc.questionId);
		}
		if (qc.status === 'partial' && qc.generationCritical) {
			partialCriticalQuestionIds.push(qc.questionId);
		}
		if (qc.status === 'contradictory') {
			contradictoryQuestionIds.push(qc.questionId);
		}
		// Required skipped: status 'partial' with skippedAt set AND required.
		if (qc.status === 'partial' && qc.skippedAt !== undefined && qc.required) {
			skippedRequiredQuestionIds.push(qc.questionId);
		}
	}

	// --- By-phase aggregation ---
	const byPhase: Record<string, PhaseCompleteness> = {};
	for (const [phaseId, qcList] of Object.entries(byPhaseGroups)) {
		byPhase[phaseId] = aggregatePhaseCompleteness(phaseId, qcList);
	}

	// --- Cross-validation warnings ---
	// Warn on intake records referencing questions not in the registry.
	for (const key of Object.keys(intakeState.answeredQuestions)) {
		if (!(key in byQuestion)) {
			warnings.push(`answer_record_references_unknown_question: "${key}"`);
		}
	}
	for (const key of Object.keys(intakeState.partialQuestions)) {
		if (!(key in byQuestion)) {
			warnings.push(`partial_record_references_unknown_question: "${key}"`);
		}
	}
	for (const key of Object.keys(intakeState.skippedQuestions)) {
		if (!(key in byQuestion)) {
			warnings.push(`skipped_record_references_unknown_question: "${key}"`);
		}
	}
	for (const contradiction of Object.values(intakeState.contradictions)) {
		if (!(contradiction.questionId in byQuestion)) {
			warnings.push(
				`contradiction_references_unknown_question: "${contradiction.id}" → "${contradiction.questionId}"`,
			);
		}
	}

	// Warn on active question id not in registry.
	if (
		intakeState.activeQuestionId !== undefined &&
		!(intakeState.activeQuestionId in byQuestion)
	) {
		warnings.push(
			`active_question_id_missing_from_registry: "${intakeState.activeQuestionId}"`,
		);
	}

	return {
		blockingQuestionIds,
		byPhase,
		byQuestion,
		completenessScore: computeAggregateScore(allScores, total),
		contradictory,
		contradictoryQuestionIds,
		criticalSufficient,
		criticalTotal,
		missing,
		missingCriticalQuestionIds,
		partial,
		partialCriticalQuestionIds,
		requiredSufficient,
		requiredTotal,
		skipped,
		skippedRequiredQuestionIds,
		sufficient,
		total,
		warnings,
	};
}
