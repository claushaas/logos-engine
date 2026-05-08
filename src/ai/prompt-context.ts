import type {
	CanonicalDocument,
	ProfileContract,
} from '../domain/profile-loader.js';
import type { WorkspaceState } from '../domain/workspace-state.js';
import type { AiOperationId } from './ai-operations.js';

export const promptContextVersion = 'logos.prompt-context.v1';

export const promptContextCategories = [
	'user_fact',
	'assumption',
	'open_question',
	'proposed_decision',
	'confirmed_decision',
	'profile_requirement',
	'document_completion_criteria',
	'validation_finding',
] as const;

export type PromptContextCategory = (typeof promptContextCategories)[number];

export type ContextSelectionRule = {
	readonly includeAssumptions: boolean;
	readonly includeConfirmedDecisions: boolean;
	readonly includeDocumentCompletionCriteria: boolean;
	readonly includeOpenQuestions: boolean;
	readonly includeProfileRequirements: boolean;
	readonly includeProposedDecisions: boolean;
	readonly includeUserFacts: boolean;
	readonly includeValidationFindings: boolean;
	readonly rationale: string;
	readonly requiresTargetDocument: boolean;
};

export type PromptContextItem = {
	readonly category: PromptContextCategory;
	readonly content: unknown;
	readonly id: string;
	readonly label: string;
	readonly reason: string;
	readonly source: string;
};

export type PromptContextDisclosure = {
	readonly contextLeavesMachine: boolean | null;
	readonly items: readonly string[];
	readonly summary: string;
	readonly version: typeof promptContextVersion;
};

export type PromptContextBundle = {
	readonly disclosure: PromptContextDisclosure;
	readonly estimatedCharacters: number;
	readonly items: readonly PromptContextItem[];
	readonly operationId: AiOperationId;
	readonly selectionRule: ContextSelectionRule;
	readonly version: typeof promptContextVersion;
};

export type BuildPromptContextInput = {
	readonly maxItemsPerCategory?: number;
	readonly operationId: AiOperationId;
	readonly profile?: ProfileContract;
	readonly targetDocumentId?: string;
	readonly targetSectionId?: string;
	readonly workspace?: WorkspaceState;
};

export const contextSelectionRules = {
	classify_assumptions: {
		includeAssumptions: true,
		includeConfirmedDecisions: true,
		includeDocumentCompletionCriteria: false,
		includeOpenQuestions: true,
		includeProfileRequirements: true,
		includeProposedDecisions: false,
		includeUserFacts: true,
		includeValidationFindings: false,
		rationale:
			'Classifying assumptions needs user facts, existing assumptions, uncertainty, and profile expectations.',
		requiresTargetDocument: false,
	},
	draft_document_section: {
		includeAssumptions: true,
		includeConfirmedDecisions: true,
		includeDocumentCompletionCriteria: true,
		includeOpenQuestions: true,
		includeProfileRequirements: true,
		includeProposedDecisions: true,
		includeUserFacts: true,
		includeValidationFindings: true,
		rationale:
			'Drafting a document section needs the target document contract plus separated project knowledge.',
		requiresTargetDocument: true,
	},
	extract_decision_proposals: {
		includeAssumptions: true,
		includeConfirmedDecisions: true,
		includeDocumentCompletionCriteria: false,
		includeOpenQuestions: true,
		includeProfileRequirements: true,
		includeProposedDecisions: false,
		includeUserFacts: true,
		includeValidationFindings: false,
		rationale:
			'Decision extraction needs user facts and uncertainty but must not treat existing proposals as facts.',
		requiresTargetDocument: false,
	},
	generate_follow_up_questions: {
		includeAssumptions: true,
		includeConfirmedDecisions: true,
		includeDocumentCompletionCriteria: false,
		includeOpenQuestions: true,
		includeProfileRequirements: true,
		includeProposedDecisions: true,
		includeUserFacts: true,
		includeValidationFindings: true,
		rationale:
			'Follow-up questions should be guided by profile gaps, known facts, open questions, and validation findings.',
		requiresTargetDocument: false,
	},
	identify_gaps: {
		includeAssumptions: true,
		includeConfirmedDecisions: true,
		includeDocumentCompletionCriteria: true,
		includeOpenQuestions: true,
		includeProfileRequirements: true,
		includeProposedDecisions: true,
		includeUserFacts: true,
		includeValidationFindings: true,
		rationale:
			'Gap analysis compares separated project knowledge against profile and document requirements.',
		requiresTargetDocument: false,
	},
	identify_risks: {
		includeAssumptions: true,
		includeConfirmedDecisions: true,
		includeDocumentCompletionCriteria: true,
		includeOpenQuestions: true,
		includeProfileRequirements: true,
		includeProposedDecisions: true,
		includeUserFacts: true,
		includeValidationFindings: true,
		rationale:
			'Risk analysis needs the confirmed context, assumptions, unresolved questions, and relevant contracts.',
		requiresTargetDocument: false,
	},
	recommend_next_question_group: {
		includeAssumptions: true,
		includeConfirmedDecisions: true,
		includeDocumentCompletionCriteria: false,
		includeOpenQuestions: true,
		includeProfileRequirements: true,
		includeProposedDecisions: true,
		includeUserFacts: true,
		includeValidationFindings: true,
		rationale:
			'Question group recommendations should use profile structure and the current state of known and missing information.',
		requiresTargetDocument: false,
	},
	summarize_answer: {
		includeAssumptions: false,
		includeConfirmedDecisions: false,
		includeDocumentCompletionCriteria: false,
		includeOpenQuestions: false,
		includeProfileRequirements: false,
		includeProposedDecisions: false,
		includeUserFacts: true,
		includeValidationFindings: false,
		rationale:
			'Summarizing answers should use only the provided or stored user answer context.',
		requiresTargetDocument: false,
	},
} as const satisfies Record<AiOperationId, ContextSelectionRule>;

const categoryOrder = new Map(
	promptContextCategories.map((category, index) => [category, index]),
);

export function buildPromptContext(
	input: BuildPromptContextInput,
): PromptContextBundle {
	const selectionRule = contextSelectionRules[input.operationId];
	const targetDocument = findTargetDocument(input);
	const targetSectionExists =
		!input.targetSectionId ||
		targetDocument?.sections.some(
			(section) => section.id === input.targetSectionId,
		);

	if (selectionRule.requiresTargetDocument && !targetDocument) {
		throw new PromptContextError(
			`Operation ${input.operationId} requires targetDocumentId for document-contract-aware prompting.`,
		);
	}

	if (!targetSectionExists) {
		throw new PromptContextError(
			`Document ${targetDocument?.id} does not define target section ${input.targetSectionId}.`,
		);
	}

	const maxItemsPerCategory = input.maxItemsPerCategory ?? 12;
	const items = limitItemsPerCategory(
		[
			...buildProfileRequirementItems(input, selectionRule),
			...buildDocumentCompletionItems(input, selectionRule, targetDocument),
			...buildWorkspaceItems(input, selectionRule),
		].sort(compareContextItems),
		maxItemsPerCategory,
	);

	return {
		disclosure: buildPromptContextDisclosure(input.operationId, items),
		estimatedCharacters: estimatePromptContextCharacters(items),
		items,
		operationId: input.operationId,
		selectionRule,
		version: promptContextVersion,
	};
}

export function estimatePromptContextCharacters(
	items: readonly PromptContextItem[],
): number {
	return items.reduce(
		(total, item) => total + item.label.length + serializeContext(item).length,
		0,
	);
}

export function groupPromptContextItems(
	items: readonly PromptContextItem[],
): Record<PromptContextCategory, readonly PromptContextItem[]> {
	const groupedItems = {} as Record<
		PromptContextCategory,
		readonly PromptContextItem[]
	>;

	for (const category of promptContextCategories) {
		groupedItems[category] = items.filter((item) => item.category === category);
	}

	return groupedItems;
}

export function serializeContext(item: PromptContextItem): string {
	return JSON.stringify(item.content, null, 2);
}

function buildPromptContextDisclosure(
	operationId: AiOperationId,
	items: readonly PromptContextItem[],
): PromptContextDisclosure {
	const categories = [...new Set(items.map((item) => item.category))];
	const categorySummary =
		categories.length > 0 ? categories.join(', ') : 'no project context';

	return {
		contextLeavesMachine: null,
		items: items.map(
			(item) =>
				`${item.category}:${item.id} from ${item.source} - ${item.reason}`,
		),
		summary: `Prompt for ${operationId} includes ${items.length} selected context item(s): ${categorySummary}. Unrelated project files are excluded by default.`,
		version: promptContextVersion,
	};
}

function buildProfileRequirementItems(
	input: BuildPromptContextInput,
	selectionRule: ContextSelectionRule,
): readonly PromptContextItem[] {
	if (!selectionRule.includeProfileRequirements || !input.profile) {
		return [];
	}

	return [
		{
			category: 'profile_requirement',
			content: {
				documentIds: input.profile.documents.map((document) => document.id),
				id: input.profile.id,
				name: input.profile.name,
				phases: input.profile.phases.map((phase) => ({
					id: phase.id,
					title: phase.title,
				})),
				questionSetIds: input.profile.questionSets.map(
					(questionSet) => questionSet.id,
				),
				targetUser: input.profile.targetUser,
				version: input.profile.version,
			},
			id: input.profile.id,
			label: `Profile requirements: ${input.profile.name}`,
			reason: 'Required by operation context selection rules.',
			source: 'profile contract',
		},
	];
}

function buildDocumentCompletionItems(
	input: BuildPromptContextInput,
	selectionRule: ContextSelectionRule,
	targetDocument: CanonicalDocument | null,
): readonly PromptContextItem[] {
	if (
		!selectionRule.includeDocumentCompletionCriteria ||
		!input.profile ||
		!targetDocument
	) {
		return [];
	}

	const targetSections = input.targetSectionId
		? targetDocument.sections.filter(
				(section) => section.id === input.targetSectionId,
			)
		: targetDocument.sections;

	return [
		{
			category: 'document_completion_criteria',
			content: {
				completionCriteria: targetDocument.completionCriteria,
				dependencies: targetDocument.dependencies,
				generatedOutputs: targetDocument.generatedOutputs,
				id: targetDocument.id,
				path: targetDocument.path,
				primaryQuestions: targetDocument.primaryQuestions,
				purpose: targetDocument.purpose,
				requiredInputs: targetDocument.requiredInputs,
				sections: targetSections,
				title: targetDocument.title,
				validationRules: targetDocument.validationRules,
			},
			id: targetDocument.id,
			label: `Document contract: ${targetDocument.title}`,
			reason: input.targetSectionId
				? `Target section ${input.targetSectionId} requires document completion criteria.`
				: 'Target document completion criteria are required for this operation.',
			source: 'profile document contract',
		},
	];
}

function buildWorkspaceItems(
	input: BuildPromptContextInput,
	selectionRule: ContextSelectionRule,
): readonly PromptContextItem[] {
	if (!input.workspace) {
		return [];
	}

	return [
		...(selectionRule.includeUserFacts
			? input.workspace.answers.answers
					.filter((answer) => answer.status === 'answered')
					.map((answer) => ({
						category: 'user_fact' as const,
						content: {
							answer: answer.answer,
							answeredAt: answer.answeredAt,
							questionId: answer.questionId,
						},
						id: answer.id,
						label: `User fact from ${answer.questionId}`,
						reason: 'User-provided answer selected for this operation.',
						source: '.logos/answers.json',
					}))
			: []),
		...(selectionRule.includeAssumptions
			? [
					...input.workspace.answers.answers
						.filter((answer) => answer.status === 'assumption')
						.map((answer) => ({
							category: 'assumption' as const,
							content: {
								answer: answer.answer,
								answeredAt: answer.answeredAt,
								questionId: answer.questionId,
							},
							id: answer.id,
							label: `Assumption from ${answer.questionId}`,
							reason: 'Assumption answers must remain separate from facts.',
							source: '.logos/answers.json',
						})),
					...input.workspace.decisions.decisions
						.filter((decision) => decision.status === 'assumed')
						.map((decision) => ({
							category: 'assumption' as const,
							content: {
								rationale: decision.rationale,
								value: decision.value,
							},
							id: decision.id,
							label: `Assumed decision ${decision.id}`,
							reason: 'Assumed decisions must not be treated as confirmed.',
							source: '.logos/decisions.json',
						})),
				]
			: []),
		...(selectionRule.includeOpenQuestions
			? input.workspace.answers.answers
					.filter((answer) => answer.status === 'unknown')
					.map((answer) => ({
						category: 'open_question' as const,
						content: {
							answer: answer.answer,
							answeredAt: answer.answeredAt,
							questionId: answer.questionId,
						},
						id: answer.id,
						label: `Open question from ${answer.questionId}`,
						reason: 'Unknown answers are unresolved project context.',
						source: '.logos/answers.json',
					}))
			: []),
		...(selectionRule.includeProposedDecisions
			? input.workspace.decisions.decisions
					.filter((decision) => decision.status === 'proposed')
					.map((decision) => ({
						category: 'proposed_decision' as const,
						content: {
							rationale: decision.rationale,
							value: decision.value,
						},
						id: decision.id,
						label: `Proposed decision ${decision.id}`,
						reason:
							'Proposed decisions are AI or system suggestions awaiting confirmation.',
						source: '.logos/decisions.json',
					}))
			: []),
		...(selectionRule.includeConfirmedDecisions
			? input.workspace.decisions.decisions
					.filter((decision) => decision.status === 'confirmed')
					.map((decision) => ({
						category: 'confirmed_decision' as const,
						content: {
							confirmedAt: decision.confirmedAt,
							rationale: decision.rationale,
							value: decision.value,
						},
						id: decision.id,
						label: `Confirmed decision ${decision.id}`,
						reason: 'Confirmed user decisions may be used as project facts.',
						source: '.logos/decisions.json',
					}))
			: []),
		...(selectionRule.includeValidationFindings
			? input.workspace.diagnostics.diagnostics.map((diagnostic) => ({
					category: 'validation_finding' as const,
					content: {
						message: diagnostic.message,
						severity: diagnostic.severity,
					},
					id: diagnostic.id,
					label: `Validation finding ${diagnostic.id}`,
					reason: 'Validation findings identify deterministic gaps or risks.',
					source: '.logos/diagnostics.json',
				}))
			: []),
	];
}

function findTargetDocument(
	input: BuildPromptContextInput,
): CanonicalDocument | null {
	if (!input.profile || !input.targetDocumentId) {
		return null;
	}

	const targetDocument =
		input.profile.documents.find(
			(document) => document.id === input.targetDocumentId,
		) ?? null;

	if (!targetDocument) {
		throw new PromptContextError(
			`Profile ${input.profile.id} does not define target document ${input.targetDocumentId}.`,
		);
	}

	return targetDocument;
}

function limitItemsPerCategory(
	items: readonly PromptContextItem[],
	maxItemsPerCategory: number,
): readonly PromptContextItem[] {
	const counts = new Map<PromptContextCategory, number>();

	return items.filter((item) => {
		const currentCount = counts.get(item.category) ?? 0;

		if (currentCount >= maxItemsPerCategory) {
			return false;
		}

		counts.set(item.category, currentCount + 1);
		return true;
	});
}

function compareContextItems(
	left: PromptContextItem,
	right: PromptContextItem,
): number {
	return (
		(categoryOrder.get(left.category) ?? 0) -
			(categoryOrder.get(right.category) ?? 0) ||
		left.id.localeCompare(right.id)
	);
}

export class PromptContextError extends Error {
	public constructor(message: string) {
		super(message);
		this.name = 'PromptContextError';
	}
}
