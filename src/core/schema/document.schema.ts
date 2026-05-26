// Purpose: Document schema with interview coverage model.
// What it should do: Define document-level descriptors, sections, interview config with coverage topics, and outputs.
// Why it exists: Connects interview questions to generated documentation via canonical question + coverage model.

import { z } from 'zod';

// ─── Interview mode ─────────────────────────────────────────────────────────

export const DocumentInterviewModeSchema = z.enum([
	'canonical_question_with_coverage',
]);

export type DocumentInterviewMode = z.infer<typeof DocumentInterviewModeSchema>;

// ─── Expected answer shape ──────────────────────────────────────────────────

export const ExpectedAnswerShapeSchema = z.object({
	allowBullets: z.boolean(),
	allowNarrative: z.boolean(),
	preferredDepth: z.enum(['brief', 'medium', 'deep']).optional(),
	style: z.enum(['freeform_structured', 'narrative', 'bullets', 'mixed']),
});

export type ExpectedAnswerShape = z.infer<typeof ExpectedAnswerShapeSchema>;

// ─── Coverage topic ─────────────────────────────────────────────────────────

export const CoverageTopicSchema = z.object({
	description: z.string(),
	evaluationHint: z.string().optional(),
	extractionHints: z.array(z.string()).optional(),
	generationHints: z.array(z.string()).optional(),
	id: z.string(),
	label: z.string(),
	required: z.boolean(),
	/** Preserved questions from the original sections[].questions. */
	sourceQuestions: z.array(z.string()),
	targetSections: z.array(z.string()).optional(),
});

export type CoverageTopic = z.infer<typeof CoverageTopicSchema>;

// ─── Sufficiency policy ─────────────────────────────────────────────────────

export const SufficiencyPolicySchema = z.object({
	allowPartialGeneration: z.boolean(),
	maxFollowUps: z.number().int().min(0),
	minimumRequiredCoverage: z.array(z.string()).optional(),
	requiredCoverageRatio: z.number().min(0).max(1).optional(),
	requiredTopicsMustBeCovered: z.boolean(),
});

export type SufficiencyPolicy = z.infer<typeof SufficiencyPolicySchema>;

// ─── Follow-up policy ───────────────────────────────────────────────────────

export const FollowUpPolicySchema = z.object({
	allowPartialGenerationAfterMaxFollowUps: z.boolean(),
	askOnlyAboutMissingTopics: z.boolean(),
	groupRelatedTopics: z.boolean(),
	maxMissingTopicsPerFollowUp: z.number().int().min(1),
});

export type FollowUpPolicy = z.infer<typeof FollowUpPolicySchema>;

// ─── Document interview ─────────────────────────────────────────────────────

export const GenerationMappingSchema = z.record(
	z.string(),
	z.object({
		targetSections: z.array(z.string()),
	}),
);

export const DocumentInterviewSchema = z.object({
	canonicalQuestion: z.string(),
	coverageTopics: z.array(CoverageTopicSchema).min(1),
	expectedAnswerShape: ExpectedAnswerShapeSchema,
	followUpPolicy: FollowUpPolicySchema,
	generationMapping: GenerationMappingSchema.optional(),
	mode: DocumentInterviewModeSchema,
	sufficiency: SufficiencyPolicySchema,
});

export type DocumentInterview = z.infer<typeof DocumentInterviewSchema>;

// ─── Coverage assessment (LLM structured output) ────────────────────────────

export const CoverageAssessmentSchema = z.object({
	confidence: z.enum(['low', 'medium', 'high']),
	coveredTopicIds: z.array(z.string()),
	missingOptionalTopicIds: z.array(z.string()),
	missingRequiredTopicIds: z.array(z.string()),
	reasoningSummary: z.string(),
	recommendedFollowUp: z.string().nullable(),
	sufficiency: z.enum([
		'sufficient',
		'needs_complement',
		'insufficient',
		'conflict',
	]),
	weakTopicIds: z.array(z.string()),
});

export type CoverageAssessment = z.infer<typeof CoverageAssessmentSchema>;

// ─── Section (legacy + extended) ────────────────────────────────────────────

export const DocumentSectionSchema = z.object({
	antiPatterns: z.array(z.string()).optional(),
	id: z.string(),
	intent: z.string().optional(),
	outputGuidance: z.array(z.string()).optional(),
	qualityChecks: z.array(z.string()).optional(),
	/**
	 * @deprecated Use `document.interview.coverageTopics[].sourceQuestions` instead.
	 * Preserved for backward compatibility during migration.
	 */
	questions: z.array(z.string()).optional(),
	required: z.boolean().optional().default(true),
	title: z.string(),
});

export type DocumentSection = z.infer<typeof DocumentSectionSchema>;

// ─── Review checklist (derived from qualityChecks + reviewRules) ────────────

export const ReviewChecklistSchema = z.object({
	documentId: z.string(),
	items: z.array(
		z.object({
			category: z.enum([
				'completeness',
				'clarity',
				'consistency',
				'traceability',
				'decision_quality',
			]),
			description: z.string(),
			id: z.string(),
			sourceSectionId: z.string().optional(),
			sourceTopicId: z.string().optional(),
		}),
	),
});

export type ReviewChecklist = z.infer<typeof ReviewChecklistSchema>;

// ─── Full document descriptor ───────────────────────────────────────────────

export const DocumentDescriptorSchema = z.object({
	centralQuestion: z.string(),
	completionCriteria: z.array(z.string()).optional(),
	dependsOn: z.array(z.string()).optional().default([]),
	feeds: z.array(z.string()).optional().default([]),
	generationRules: z.array(z.string()).optional(),
	id: z.string(),
	inputs: z
		.array(
			z.object({
				description: z.string().optional(),
				id: z.string(),
				required: z.boolean().optional().default(false),
				type: z.string(),
			}),
		)
		.optional(),
	/** New interview model with canonical question + coverage topics. */
	interview: DocumentInterviewSchema.optional(),
	order: z.number().int().optional(),
	outputs: z.object({
		agentPacks: z
			.array(z.record(z.string(), z.unknown()))
			.optional()
			.default([]),
		artifacts: z
			.array(z.record(z.string(), z.unknown()))
			.optional()
			.default([]),
		canonical: z.object({
			format: z.string(),
			path: z.string(),
			purpose: z.string().optional(),
		}),
	}),
	phase: z.string(),
	purpose: z.string(),
	qualityChecks: z.array(z.string()).optional(),
	/** Review checklist derived from qualityChecks + reviewRules. */
	reviewChecklist: ReviewChecklistSchema.optional(),
	reviewRules: z.array(z.string()).optional(),
	/** Legacy sections — preserved for backward compatibility. */
	sections: z.array(DocumentSectionSchema),
	status: z.string(),
	title: z.string(),
	type: z.string(),
});

export type DocumentDescriptor = z.infer<typeof DocumentDescriptorSchema>;
