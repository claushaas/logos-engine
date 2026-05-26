// Purpose: Prompt builder for answer assessment with coverage model.
// What it should do: Build deterministic messages for assessing whether a user answer
//                    covers the required coverage topics for a document.
// Why it exists: Separates semantic assessment instructions from workflow code.
//
// New model (canonical_question_with_coverage):
//   - Receives canonicalQuestion + coverageTopics instead of individual section questions.
//   - Evaluates user answer against coverageTopics, not as a linear Q&A.
//   - Returns CoverageAssessment via generateStructuredOutput().
//
// Legacy model (section questions):
//   - Still supported via sections[].questions but deprecated.

export function assess_answer() {
	// TODO: implement coverage-based answer assessment.
	// Expected structured output: CoverageAssessment (see src/core/schema/document.schema.ts)
	// Input: canonicalQuestion, coverageTopics, sufficiency, followUpPolicy, transcript messages
	return [];
}
