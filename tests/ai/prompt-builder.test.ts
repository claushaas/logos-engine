import { describe, expect, it } from 'vitest';
import {
	buildPromptContext,
	buildPromptForAiOperation,
	defaultAiProviderConfig,
	loadProfileById,
	PromptContextError,
	type WorkspaceState,
	workspaceSchemaVersion,
} from '../../src/index.js';

describe('prompt and context management', () => {
	it('builds inspectable prompts with separated context and output schema instructions', () => {
		const built = buildPromptForAiOperation({
			operationId: 'generate_follow_up_questions',
			profile: loadProfileById('app-business'),
			workspace: createWorkspaceState(),
		});

		expect(built.contract.promptVersion).toBe(
			'logos.prompt-builder.v1.generate_follow_up_questions.v1',
		);
		expect(built.request.input).toMatchObject({
			contextVersion: 'logos.prompt-context.v1',
			promptBuilderVersion: 'logos.prompt-builder.v1',
			promptVersion: built.contract.promptVersion,
		});
		expect(built.request.contextDisclosure?.summary).toContain(
			'Unrelated project files are excluded by default.',
		);
		expect([
			...new Set(built.context.items.map((item) => item.category)),
		]).toEqual([
			'user_fact',
			'assumption',
			'open_question',
			'proposed_decision',
			'confirmed_decision',
			'profile_requirement',
			'validation_finding',
		]);

		const systemPrompt = built.request.messages[0]?.content ?? '';
		const userPrompt = built.request.messages[1]?.content ?? '';

		expect(systemPrompt).toContain(
			'Separate confirmed user facts, assumptions, open questions, proposed decisions, confirmed decisions, profile requirements, and document completion criteria.',
		);
		expect(userPrompt).toContain('## Confirmed User Facts');
		expect(userPrompt).toContain('## Assumptions');
		expect(userPrompt).toContain('## Open Questions');
		expect(userPrompt).toContain('## Proposed Decisions');
		expect(userPrompt).toContain('## Confirmed Decisions');
		expect(userPrompt).toContain('## Profile Requirements');
		expect(userPrompt).toContain('Return only one JSON object.');
		expect(userPrompt).toContain('Never return status "confirmed"');
		expect(userPrompt).toContain('"questions"');
		expect(
			userPrompt.split('\n').slice(0, 9).join('\n'),
		).toMatchInlineSnapshot(`
"Operation: generate_follow_up_questions
Task: Generate a small set of necessary follow-up questions that clarify intent and unblock downstream documents.
Context selection rationale: Follow-up questions should be guided by profile gaps, known facts, open questions, and validation findings.
Context disclosure: Prompt for generate_follow_up_questions includes 8 selected context item(s): user_fact, assumption, open_question, proposed_decision, confirmed_decision, profile_requirement, validation_finding. Unrelated project files are excluded by default.

Selected context:
## Confirmed User Facts
- User fact from foundation.idea (.logos/answers.json; User-provided answer selected for this operation.)
  {"
`);
	});

	it('keeps summarize-answer context intentionally minimal', () => {
		const context = buildPromptContext({
			operationId: 'summarize_answer',
			profile: loadProfileById('app-business'),
			workspace: createWorkspaceState(),
		});

		expect(context.items.map((item) => item.category)).toEqual(['user_fact']);
		expect(context.disclosure.items).toEqual([
			'user_fact:answer.idea from .logos/answers.json - User-provided answer selected for this operation.',
		]);
	});

	it('includes target document completion criteria only when document context is required', () => {
		const built = buildPromptForAiOperation({
			input: {
				requestedSection: 'purpose',
			},
			operationId: 'draft_document_section',
			profile: loadProfileById('app-business'),
			targetDocumentId: 'intake.idea_brief',
			targetSectionId: 'purpose',
			workspace: createWorkspaceState(),
		});

		const userPrompt = built.request.messages[1]?.content ?? '';

		expect(
			built.context.items.some(
				(item) => item.category === 'document_completion_criteria',
			),
		).toBe(true);
		expect(userPrompt).toContain('Document contract: Idea Brief');
		expect(userPrompt).toContain('"completionCriteria"');
		expect(userPrompt).toContain('"id": "purpose"');
		expect(userPrompt).not.toContain('"id": "initial_idea"');
	});

	it('requires a target document for document-section drafting', () => {
		expect(() =>
			buildPromptForAiOperation({
				operationId: 'draft_document_section',
				profile: loadProfileById('app-business'),
				workspace: createWorkspaceState(),
			}),
		).toThrow(PromptContextError);
	});
});

const timestamp = '2026-05-08T12:00:00.000Z';

function createWorkspaceState(): WorkspaceState {
	return {
		answers: {
			answers: [
				{
					answer:
						'A local-first TUI that turns unclear app ideas into structured project documentation.',
					answeredAt: timestamp,
					id: 'answer.idea',
					questionId: 'foundation.idea',
					status: 'answered',
				},
				{
					answer: 'Initial users may be solo app founders.',
					answeredAt: timestamp,
					id: 'answer.target_user_assumption',
					questionId: 'foundation.primary_user',
					status: 'assumption',
				},
				{
					answer: null,
					answeredAt: timestamp,
					id: 'answer.pricing_unknown',
					questionId: 'economics.pricing_model',
					status: 'unknown',
				},
			],
			schemaVersion: workspaceSchemaVersion,
		},
		config: {
			ai: defaultAiProviderConfig,
			schemaVersion: workspaceSchemaVersion,
		},
		decisions: {
			decisions: [
				{
					confirmedAt: timestamp,
					id: 'foundation.initial_idea',
					rationale: 'User explicitly described the idea.',
					status: 'confirmed',
					value: 'AI-structured documentation TUI',
				},
				{
					confirmedAt: null,
					id: 'foundation.target_user',
					rationale: 'Inferred from early answer and needs confirmation.',
					status: 'proposed',
					value: 'solo founders',
				},
				{
					confirmedAt: null,
					id: 'market.size_assumption',
					rationale: 'No market validation has been provided.',
					status: 'assumed',
					value: 'small but reachable niche',
				},
			],
			schemaVersion: workspaceSchemaVersion,
		},
		diagnostics: {
			diagnostics: [
				{
					id: 'diagnostic.pricing_missing',
					message: 'Pricing model is not known yet.',
					severity: 'warning',
				},
			],
			generatedAt: timestamp,
			schemaVersion: workspaceSchemaVersion,
		},
		profileLock: {
			documentCount: 32,
			lockedAt: timestamp,
			profileId: 'app-business',
			profileName: 'App Business',
			profileVersion: '0.1.0',
			schemaVersion: workspaceSchemaVersion,
		},
		project: {
			createdAt: timestamp,
			profileId: 'app-business',
			projectName: 'Test Project',
			projectRoot: '.',
			schemaVersion: workspaceSchemaVersion,
			updatedAt: timestamp,
		},
	};
}
