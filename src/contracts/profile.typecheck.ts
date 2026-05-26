/**
 * Compile-time profile type assertions.
 *
 * This file exercises TypeScript-level type identity for the contracts module.
 * It is NOT a runtime test — if any assertion were violated, the project would
 * not type-check.
 *
 * Tests:
 *  1. Minimal valid `LogosProfile` compiles.
 *  2. Hand-constructed "Startup" profile (from 13-prototypes.md) type-checks.
 *  3. `NodeId` is not assignable to `DocumentId` (branded type safety).
 *  4. `DocumentId` is not assignable to `NodeId`.
 */
import type {
	DocumentId,
	DocumentMaterializationSectionDefinition,
	LogosProfile,
	NodeId,
	NodePromptRefs,
	ProfileId,
	PromptId,
} from './index.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

type IsAssignable<A, B> = [A] extends [B] ? true : false;
type ExpectFalse<T extends false> = T;

// ─── 1. Minimal valid LogosProfile compiles ─────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _minimalProfile: LogosProfile = {
	documents: [
		{
			id: 'doc_thesis' as DocumentId,
			optionalNodeIds: [],
			order: 1,
			outputPath: 'docs/01-foundation/thesis.md',
			phaseId: '01-foundation',
			purpose: 'Articulate the central thesis.',
			requiredNodeIds: ['node_thesis_core' as NodeId],
			title: 'Thesis',
		},
	],
	id: 'p_minimal' as ProfileId,
	materializationRules: [
		{
			documentId: 'doc_thesis' as DocumentId,
			optionalNodeIds: [],
			outputPath: 'docs/01-foundation/thesis.md',
			requiredNodeIds: ['node_thesis_core' as NodeId],
			sections: [
				{
					id: 'core-section',
					required: true,
					sourceNodeIds: ['node_thesis_core' as NodeId],
					title: 'Core Thesis',
				},
			],
			sourceNodeIds: ['node_thesis_core' as NodeId],
			title: 'Thesis Output',
		},
	],
	nodes: [
		{
			canonicalQuestion: 'What truth justifies this project?',
			coverageTopics: ['central conviction', 'unresolved tension'],
			documentId: 'doc_thesis' as DocumentId,
			id: 'node_thesis_core' as NodeId,
			order: 1,
			phaseId: '01-foundation',
			promptRefs: {} as NodePromptRefs,
			sufficiencyCriteria: ['thesis is specific'],
			title: 'Core Thesis',
		},
	],
	phases: [
		{
			id: '01-foundation',
			order: 1,
			purpose: 'Define the foundational thesis.',
			title: 'Foundation',
		},
	],
	title: 'Minimal Profile',
	version: '1.0.0',
};

// ─── 2. Hand-constructed "Startup" profile type-checks ──────────────────────

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _startupProfile: LogosProfile = {
	description: 'Standard profile for startup documentation across 6 phases.',
	documents: [
		{
			id: 'doc_foundation_thesis' as DocumentId,
			optionalNodeIds: ['node_thesis_evidence' as NodeId],
			order: 1,
			outputPath: 'docs/01-foundation/01-thesis.md',
			phaseId: '01-foundation',
			purpose: 'Articulate the central thesis.',
			requiredNodeIds: [
				'node_thesis_core' as NodeId,
				'node_thesis_context' as NodeId,
			],
			title: 'Thesis',
		},
		{
			id: 'doc_foundation_problem' as DocumentId,
			optionalNodeIds: [],
			order: 2,
			outputPath: 'docs/01-foundation/02-problem.md',
			phaseId: '01-foundation',
			purpose: 'Define the real problem.',
			requiredNodeIds: ['node_problem_core' as NodeId],
			title: 'Problem',
		},
		{
			id: 'doc_validation_strategy' as DocumentId,
			optionalNodeIds: [],
			order: 1,
			outputPath: 'docs/02-validation/01-validation-strategy.md',
			phaseId: '02-validation',
			purpose: 'Define how to validate key assumptions.',
			requiredNodeIds: ['node_val_strategy' as NodeId],
			title: 'Validation Strategy',
		},
	],
	id: 'profile_startup' as ProfileId,
	materializationRules: [
		{
			documentId: 'doc_foundation_thesis' as DocumentId,
			optionalNodeIds: ['node_thesis_evidence' as NodeId],
			outputPath: 'docs/01-foundation/01-thesis.md',
			requiredNodeIds: [
				'node_thesis_core' as NodeId,
				'node_thesis_context' as NodeId,
			],
			sections: [
				{
					id: 'core-thesis',
					required: true,
					sourceNodeIds: ['node_thesis_core' as NodeId],
					title: 'Core Thesis',
				} satisfies DocumentMaterializationSectionDefinition,
				{
					id: 'context',
					required: true,
					sourceNodeIds: ['node_thesis_context' as NodeId],
					title: 'Context',
				} satisfies DocumentMaterializationSectionDefinition,
				{
					id: 'evidence',
					required: false,
					sourceNodeIds: ['node_thesis_evidence' as NodeId],
					title: 'Supporting Evidence',
				} satisfies DocumentMaterializationSectionDefinition,
			],
			sourceNodeIds: [
				'node_thesis_core' as NodeId,
				'node_thesis_context' as NodeId,
				'node_thesis_evidence' as NodeId,
			],
			title: 'Foundation Thesis Document',
		},
	],
	nodes: [
		{
			canonicalQuestion:
				'What truth, hypothesis, or conviction justifies this project existing?',
			coverageTopics: [
				'central conviction',
				'relevant change in the world',
				'unresolved tension',
				'ignored truth',
				'promise without marketing',
			],
			documentId: 'doc_foundation_thesis' as DocumentId,
			id: 'node_thesis_core' as NodeId,
			order: 1,
			phaseId: '01-foundation',
			promptRefs: {
				clarification: 'prompt_foundation_thesis_clarification' as PromptId,
				initial: 'prompt_foundation_thesis_initial' as PromptId,
				refinement: 'prompt_foundation_thesis_refinement' as PromptId,
				review: 'prompt_foundation_thesis_review' as PromptId,
				synthesis: 'prompt_foundation_thesis_synthesis' as PromptId,
			},
			sufficiencyCriteria: [
				'thesis is specific to the project',
				'problem is not confused with solution',
				'central tension is explicit',
				'unsupported claims are marked as assumptions',
			],
			title: 'Core Thesis',
		},
		{
			canonicalQuestion: 'What broader conditions make this thesis relevant?',
			coverageTopics: ['market conditions', 'timing', 'relevant trends'],
			dependencies: {
				requiredNodeIds: ['node_thesis_core' as NodeId],
			},
			documentId: 'doc_foundation_thesis' as DocumentId,
			id: 'node_thesis_context' as NodeId,
			order: 2,
			phaseId: '01-foundation',
			promptRefs: {
				initial: 'prompt_foundation_context_initial' as PromptId,
			},
			sufficiencyCriteria: [
				'context is specific',
				'claims are labeled as fact or assumption',
			],
			title: 'Thesis Context',
		},
		{
			canonicalQuestion:
				'What observable evidence supports or challenges the thesis?',
			coverageTopics: ['supporting observations', 'counter-evidence'],
			dependencies: {
				recommendedNodeIds: ['node_thesis_core' as NodeId],
			},
			documentId: 'doc_foundation_thesis' as DocumentId,
			id: 'node_thesis_evidence' as NodeId,
			order: 3,
			phaseId: '01-foundation',
			promptRefs: {
				initial: 'prompt_foundation_evidence_initial' as PromptId,
			},
			sufficiencyCriteria: ['evidence is specific and observable'],
			title: 'Supporting Evidence',
		},
		{
			canonicalQuestion:
				'What pain, friction, or limitation does this project exist to confront?',
			coverageTopics: [
				'pain description',
				'who experiences it',
				'current workarounds',
			],
			documentId: 'doc_foundation_problem' as DocumentId,
			id: 'node_problem_core' as NodeId,
			order: 1,
			phaseId: '01-foundation',
			promptRefs: {
				initial: 'prompt_foundation_problem_initial' as PromptId,
			},
			sufficiencyCriteria: [
				'problem is stated before solution',
				'problem is specific',
			],
			title: 'Core Problem',
		},
		{
			canonicalQuestion: 'How will we test the riskiest assumptions?',
			coverageTopics: [
				'riskiest assumptions',
				'validation methods',
				'success criteria',
			],
			dependencies: {
				recommendedNodeIds: ['node_thesis_context' as NodeId],
				requiredNodeIds: [
					'node_thesis_core' as NodeId,
					'node_problem_core' as NodeId,
				],
			},
			documentId: 'doc_validation_strategy' as DocumentId,
			id: 'node_val_strategy' as NodeId,
			order: 1,
			phaseId: '02-validation',
			promptRefs: {
				followUp: 'prompt_val_strategy_followup' as PromptId,
				initial: 'prompt_val_strategy_initial' as PromptId,
			},
			sufficiencyCriteria: [
				'each assumption has a test method',
				'criteria are falsifiable',
			],
			title: 'Validation Approach',
		},
	],
	phases: [
		{
			id: '01-foundation',
			order: 1,
			purpose:
				'Define why the project exists, for whom, under what principles.',
			title: 'Foundation',
		},
		{
			id: '02-validation',
			order: 2,
			purpose: 'Validate assumptions, hypotheses, and business model.',
			title: 'Validation',
		},
		{
			id: '03-product',
			order: 3,
			purpose: 'Define what will be built and how it is experienced.',
			title: 'Product',
		},
	],
	title: 'Startup Documentation Profile',
	version: '1.0.0',
};

// ─── 3. Branded type safety: NodeId is not assignable to DocumentId ─────────

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _node_not_doc_ctr = ExpectFalse<IsAssignable<NodeId, DocumentId>>;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _doc_not_node_ctr = ExpectFalse<IsAssignable<DocumentId, NodeId>>;

// Redundant: the file must export something to be a module.
export type __profile_typecheck = true;
