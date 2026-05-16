/** Intake module exports */

export {
	collectQuestionCandidates,
	planNextQuestions,
} from './question-planner.js';
export type {
	PlannedQuestion,
	QuestionBlockingLevel,
	QuestionCandidate,
	QuestionCluster,
	QuestionDuplicateKey,
	QuestionGap,
	QuestionPlanningDiagnostic,
	QuestionPlanningInput,
	QuestionPlanningOptions,
	QuestionPlanningResult,
	QuestionPlanReason,
	QuestionPlanStatus,
	QuestionPriority,
	QuestionSource,
} from './question-planner-types.js';
