/**
 * LOGOS Core — Next prompt selector (Step 3.3).
 *
 * Selects the single next prompt to ask the user based on durable intake state
 * and the active profile's question registry. The selector is a pure function:
 * it does not read filesystem, resolve profiles, call AI, or mutate state.
 *
 * Priority order:
 * 1. Unresolved contradiction
 * 2. Active unresolved follow-up
 * 3. Critical unanswered
 * 4. Critical partial
 * 5. Important unanswered
 * 6. Important partial
 * 7. Optional unanswered
 * 8. Optional partial
 * 9. Complete / blocked
 *
 * Boundary: must not import Pi, Ink, React, TUI, or CLI modules.
 */

import type { LogosQuestionRegistry } from '../questions/question-registry.js';
import type { LogosQuestion } from '../questions/question-types.js';
import type {
	IntakeContradictionRecord,
	LogosIntakeState,
} from '../state/intake-state-types.js';
import {
	createContradictionPrompt,
	createFollowUpPrompt,
	createQuestionPrompt,
} from './active-prompt.js';
import { checkDependencyStatus } from './dependency-status.js';
import type {
	ActivePrompt,
	NextPromptSelection,
	NextPromptSelectionReason,
} from './prompt-selection-types.js';
import type { QuestionSelectionStatus } from './question-status.js';
import { getQuestionSelectionStatus } from './question-status.js';

// ---------------------------------------------------------------------------
// Converter: selection status → reason
// ---------------------------------------------------------------------------

/**
 * Map a question's priority + selection status to a selection reason.
 * Used for diagnostic and logging purposes.
 */
function selectionReason(
	priority: 'critical' | 'important' | 'optional',
	status: QuestionSelectionStatus,
): NextPromptSelectionReason {
	if (priority === 'critical') {
		return status === 'partial' ? 'critical_partial' : 'critical_unanswered';
	}
	if (priority === 'important') {
		return status === 'partial' ? 'important_partial' : 'important_unanswered';
	}
	return status === 'partial' ? 'optional_partial' : 'optional_unanswered';
}

// ---------------------------------------------------------------------------
// Priority ordering helpers
// ---------------------------------------------------------------------------

/**
 * Numeric weight for priority buckets used in sorting.
 * Lower weight = selected first.
 */
function priorityWeight(
	priority: 'critical' | 'important' | 'optional',
): number {
	switch (priority) {
		case 'critical':
			return 0;
		case 'important':
			return 1;
		default:
			return 2;
	}
}

/**
 * Numeric weight for selection-status buckets within the same priority.
 * Unanswered comes before partial.
 */
function statusWeight(status: QuestionSelectionStatus): number {
	return status === 'unanswered' ? 0 : 1;
}

// ---------------------------------------------------------------------------
// Candidate type (module-scoped for comparator)
// ---------------------------------------------------------------------------

type Candidate = {
	question: LogosQuestion;
	status: QuestionSelectionStatus;
	/** Position in the registry array — preserves YAML section order. */
	_registryIndex: number;
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Select the single next prompt LOGOS should present to the user.
 *
 * Returns exactly one prompt (`status: "selected"`), a completion signal
 * (`status: "complete"`), or a blocker (`status: "blocked"`).
 *
 * The selector is deterministic: for the same registry and intake state
 * it will always return the same result.
 */
export function selectNextPrompt(input: {
	registry: LogosQuestionRegistry;
	intakeState: LogosIntakeState;
}): NextPromptSelection {
	const { registry, intakeState } = input;

	// ------------------------------------------------------------------
	// 1. Empty registry
	// ------------------------------------------------------------------
	if (registry.questions.length === 0) {
		return {
			blockers: ['Question registry is empty. No prompts available.'],
			reason: 'registry_empty',
			status: 'blocked',
			warnings: [],
		};
	}

	// ------------------------------------------------------------------
	// 2. Unresolved contradictions (highest priority)
	// ------------------------------------------------------------------
	const unresolvedContradictions = Object.values(intakeState.contradictions)
		.filter((c) => c.status === 'unresolved')
		.sort(compareContradictions);

	const firstContradiction = unresolvedContradictions[0];
	if (firstContradiction !== undefined) {
		const contradiction = firstContradiction;
		const question = registry.byId[contradiction.questionId];

		if (question !== undefined) {
			return {
				blockers: [],
				prompt: createContradictionPrompt({ contradiction, question }),
				reason: 'unresolved_contradiction',
				status: 'selected',
				warnings: [],
			};
		}

		// Contradiction references a question not in the registry.
		// Fall through — it will be caught by the active-prompt check below
		// if the question is also the active prompt's target.
	}

	// ------------------------------------------------------------------
	// 3. Active unresolved follow-up (second priority)
	// ------------------------------------------------------------------
	const activePrompt = intakeState.activePrompt;
	if (activePrompt !== undefined) {
		const activeQuestion = registry.byId[activePrompt.questionId];

		if (activePrompt.kind === 'follow_up') {
			if (activeQuestion === undefined) {
				return {
					blockers: [
						`Active follow-up references missing question "${activePrompt.questionId}".`,
					],
					reason: 'active_prompt_invalid',
					status: 'blocked',
					warnings: [],
				};
			}

			// Re-emit the follow-up.
			const partialRecord =
				intakeState.partialQuestions[activePrompt.questionId];

			const fuPrompt = createFollowUpPrompt({
				missingAspects: partialRecord?.missingAspects ?? [],
				question: activeQuestion,
			});
			if (activePrompt.followUpId !== undefined) {
				fuPrompt.followUpId = activePrompt.followUpId;
			}
			if (partialRecord?.reason !== undefined) {
				fuPrompt.text = `I need one clarification before moving on: ${partialRecord.reason} Please expand your answer.`;
			}
			return {
				blockers: [],
				prompt: fuPrompt,
				reason: 'active_unresolved_follow_up',
				status: 'selected',
				warnings: [],
			};
		}

		if (activePrompt.kind === 'question') {
			if (activeQuestion === undefined) {
				return {
					blockers: [
						`Active prompt (question) references missing question "${activePrompt.questionId}".`,
					],
					reason: 'active_prompt_invalid',
					status: 'blocked',
					warnings: [],
				};
			}

			// Check if the active question is in a partial state that
			// warrants re-emission as a follow-up.
			const status = getQuestionSelectionStatus({
				intakeState,
				question: activeQuestion,
			});

			if (status === 'partial') {
				const partialRecord =
					intakeState.partialQuestions[activePrompt.questionId];
				const answerRecord =
					intakeState.answeredQuestions[activePrompt.questionId];

				const refuReason = partialRecord?.reason ?? answerRecord?.status;
				const refuPrompt = createFollowUpPrompt({
					missingAspects: partialRecord?.missingAspects ?? [],
					question: activeQuestion,
				});
				if (activePrompt.followUpId !== undefined) {
					refuPrompt.followUpId = activePrompt.followUpId;
				}
				if (refuReason !== undefined) {
					refuPrompt.text = `I need one clarification before moving on: ${refuReason} Please expand your answer.`;
				}
				return {
					blockers: [],
					prompt: refuPrompt,
					reason: selectionReason(activeQuestion.priority, 'partial'),
					status: 'selected',
					warnings: [],
				};
			}

			// Question is sufficient or skipped/unanswered — this shouldn't
			// normally happen while the active prompt is still set, but
			// we fall through to the normal selection logic below.
		}

		// contradiction_resolution active prompts are already handled
		// by the contradiction check above (priority 1). Fall through.
	}

	// ------------------------------------------------------------------
	// 4. Collect candidates by priority + status bucket
	// ------------------------------------------------------------------
	const allQuestions = registry.questions;
	if (allQuestions.length === 0) {
		return {
			blockers: ['Question registry contains no questions.'],
			reason: 'registry_empty',
			status: 'blocked',
			warnings: [],
		};
	}

	// Classify every question.
	const candidates: Candidate[] = [];
	const dependencyBlockedIds: string[] = [];
	const unmetDeps: string[] = [];

	for (let i = 0; i < allQuestions.length; i++) {
		const question = allQuestions[i] as LogosQuestion;
		const qStatus = getQuestionSelectionStatus({ intakeState, question });

		if (qStatus === 'sufficient' || qStatus === 'skipped') {
			// Sufficient questions and skipped optional questions are not selected.
			continue;
		}

		if (qStatus === 'contradictory') {
			// Contradictions are handled in priority 1. Skip here.
			continue;
		}

		// Check dependency eligibility.
		const depStatus = checkDependencyStatus({
			intakeState,
			question,
			registry,
		});

		if (depStatus !== 'satisfied') {
			dependencyBlockedIds.push(question.id);
			if (depStatus === 'blocked') {
				const deps = question.dependsOn ?? [];
				unmetDeps.push(`${question.id} → ${deps.join(', ')}`);
			} else {
				unmetDeps.push(`${question.id} → unknown dependency ids`);
			}
			continue;
		}

		candidates.push({ question, status: qStatus, _registryIndex: i });
	}

	// ------------------------------------------------------------------
	// 5. Sort candidates deterministically
	// ------------------------------------------------------------------
	candidates.sort(compareCandidates);

	// Try each priority bucket in order.
	const buckets = orderedBuckets();

	for (const bucket of buckets) {
		const match = candidates.find(
			(c) =>
				c.question.priority === bucket.priority && c.status === bucket.status,
		);

		if (match !== undefined) {
			const prompt = buildPrompt(match.question, match.status, intakeState);
			return {
				blockers: [],
				prompt,
				reason: selectionReason(match.question.priority, match.status),
				status: 'selected',
				warnings: [],
			};
		}
	}

	// ------------------------------------------------------------------
	// 6. No selectable prompt
	// ------------------------------------------------------------------
	if (dependencyBlockedIds.length > 0) {
		return {
			blockers: [
				`All remaining questions are blocked by unmet dependencies: ${unmetDeps.join('; ')}`,
			],
			reason: 'dependency_blocked',
			status: 'blocked',
			warnings: [],
		};
	}

	// All questions are sufficient, skipped, or contradictory (resolved).
	return {
		blockers: [],
		reason: 'complete',
		status: 'complete',
		warnings: [],
	};
}

// ---------------------------------------------------------------------------
// Bucket ordering
// ---------------------------------------------------------------------------

type PriorityBucket = {
	priority: 'critical' | 'important' | 'optional';
	status: 'unanswered' | 'partial';
};

function orderedBuckets(): PriorityBucket[] {
	// Only ask critical questions by default.  Important and optional
	// questions can be answered later via explicit commands or when
	// the user requests more detail.
	return [
		{ priority: 'critical', status: 'unanswered' },
		{ priority: 'critical', status: 'partial' },
	];
}

// ---------------------------------------------------------------------------
// Prompt building for a candidate
// ---------------------------------------------------------------------------

function buildPrompt(
	question: LogosQuestion,
	status: QuestionSelectionStatus,
	intakeState: LogosIntakeState,
): ActivePrompt {
	if (status === 'partial') {
		const partialRecord = intakeState.partialQuestions[question.id];
		const answerRecord = intakeState.answeredQuestions[question.id];
		const buildReason =
			partialRecord?.reason ??
			answerRecord?.status ??
			'Your previous answer was incomplete.';
		const prompt = createFollowUpPrompt({
			missingAspects: partialRecord?.missingAspects ?? [],
			question,
		});
		prompt.text = `I need one clarification before moving on: ${buildReason} Please expand your answer.`;
		return prompt;
	}

	// Unanswered → normal question prompt.
	return createQuestionPrompt(question);
}

// ---------------------------------------------------------------------------
// Candidate comparator (deterministic ordering)
// ---------------------------------------------------------------------------

function compareCandidates(a: Candidate, b: Candidate): number {
	// Sort by priority weight first.
	const pw =
		priorityWeight(a.question.priority) - priorityWeight(b.question.priority);
	if (pw !== 0) return pw;

	// Within same priority, unanswered before partial.
	const sw = statusWeight(a.status) - statusWeight(b.status);
	if (sw !== 0) return sw;

	// Deterministic tie-breaking: use the question's position in the
	// registry to preserve the original YAML section order.  The
	// registry array is built by iterating documents and sections in
	// profile order.
	return a._registryIndex - b._registryIndex;
}

// ---------------------------------------------------------------------------
// Contradiction comparator (deterministic ordering)
// ---------------------------------------------------------------------------

function compareContradictions(
	a: IntakeContradictionRecord,
	b: IntakeContradictionRecord,
): number {
	// Earliest createdAt first.
	const ca = a.createdAt.localeCompare(b.createdAt);
	if (ca !== 0) return ca;

	// Tie-break by id.
	return a.id.localeCompare(b.id);
}
