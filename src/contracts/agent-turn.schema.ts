/**
 * Canonical JSON Schema for `AgentTurnOutput`.
 *
 * This schema constrains LLM provider output at the structural level.
 * The `validateAgentTurnOutput` function in `src/validation/` remains
 * the semantic authority — it runs Zod-based structural validation AND
 * lifecycle-transition, action-compatibility, and completeness checks
 * that a pure JSON Schema cannot express.
 *
 * ## Relationship to the Zod validator
 *
 * | Layer | What it enforces | Authority |
 * |---|---|---|
 * | JSON Schema | Types, enum values, required fields, shape | Provider constraint |
 * | Zod schema | Same structural rules (via Zod) | Redundant safety net |
 * | Semantic checks | Lifecycle transitions, action legality, draft rules | Final authority |
 *
 * In case of disagreement between the JSON Schema and the Zod schema for
 * a given input, the Zod + semantic result is authoritative. Drift tests
 * in `tests/contracts/agent-turn-json-schema.test.ts` verify that the
 * schemas agree on representative cases and document known disagreements.
 *
 * ## Provider compatibility
 *
 * Designed for OpenAI-compatible `response_format: { type: "json_schema" }`.
 * Use `strict: false` so the provider does not reject extra properties
 * (the Zod schema uses `.passthrough()`). Set `strict: true` only if the
 * provider's strict mode is compatible with the full `required` and
 * `additionalProperties` constraints defined here.
 *
 * @see {@link https://logos-engine/docs/06-agent-turn-contract.md}
 * @see {@link https://logos-engine/docs/architecture/adr/0006-use-structured-llm-output.md}
 */
import type { TransitionEvent } from './agent-turn.js';
import type { NodeAction, NodeLifecycle, PromptState } from './node-state.js';

// ═══════════════════════════════════════════════════════════════════════════
// Constants — kept in sync with contract types
// ═══════════════════════════════════════════════════════════════════════════

/**
 * All valid {@link NodeLifecycle} values.
 *
 * Must match the union in `src/contracts/node-state.ts`.
 */
const LIFECYCLE_VALUES: readonly NodeLifecycle[] = [
	'not_started',
	'active',
	'answered',
	'needs_clarification',
	'needs_refinement',
	'ready_for_synthesis',
	'synthesized',
	'accepted',
	'deferred',
	'blocked',
];

/**
 * All valid {@link PromptState} values.
 *
 * Must match the union in `src/contracts/node-state.ts`.
 */
const PROMPT_STATE_VALUES: readonly PromptState[] = [
	'initial',
	'follow_up',
	'clarification',
	'refinement',
	'synthesis',
	'review',
	'repair',
	'blocked',
	'accepted',
];

/**
 * All valid {@link NodeAction} values.
 *
 * Must match the union in `src/contracts/node-state.ts`.
 */
const ACTION_VALUES: readonly NodeAction[] = [
	'answer',
	'accept',
	'edit',
	'regenerate',
	'defer',
	'reopen',
	'skip',
	'continue_next',
	'mark_as_assumption',
	'mark_as_decision',
	'open_prerequisite',
	'open_document_preview',
	'ask_for_example',
	'resume',
];

/**
 * All valid {@link TransitionEvent} values.
 *
 * Must match the union in `src/contracts/agent-turn.ts`.
 */
const TRANSITION_EVENT_VALUES: readonly TransitionEvent[] = [
	'ASKED_INITIAL',
	'USER_ANSWER_EVALUATED',
	'CLARIFICATION_REQUESTED',
	'REFINEMENT_REQUESTED',
	'SYNTHESIS_PROPOSED',
	'REVIEW_REQUESTED',
	'NODE_BLOCKED',
	'NODE_READY_FOR_ACCEPTANCE',
];

const CONFIDENCE_VALUES = ['low', 'medium', 'high'] as const;
const FORMAT_VALUES = ['markdown', 'structured'] as const;
const SEVERITY_VALUES = ['info', 'warning', 'error'] as const;
const COVERAGE_VALUES = ['missing', 'weak', 'sufficient'] as const;

// ═══════════════════════════════════════════════════════════════════════════
// Schema name
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Schema name for use in `response_format.json_schema.name`.
 *
 * Must match `/^[a-zA-Z0-9_-]{1,64}$/` (OpenAI requirement).
 */
export const AGENT_TURN_OUTPUT_SCHEMA_NAME = 'AgentTurnOutput';

// ═══════════════════════════════════════════════════════════════════════════
// JSON Schema
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Canonical JSON Schema for `AgentTurnOutput`.
 *
 * Used as the `json_schema.schema` value in OpenAI-compatible
 * `response_format` requests.
 *
 * ## Design notes
 *
 * - Only `userFacingMessage` is required — all other fields are optional.
 * - `additionalProperties: true` at the root allows the LLM to include
 *   extra metadata (matching the Zod `.passthrough()` behaviour).
 * - Nested objects (`canonicalAnswerDraft`, `completenessEvaluation`,
 *   `extracted`, `transitionIntent`, `diagnostics` items) use
 *   `additionalProperties: false` because the contract types have exact
 *   shapes.
 * - Nullable fields (`canonicalAnswerDraft`, `transitionIntent`) use
 *   `anyOf` with a `{ type: "null" }` alternative.
 * - Enum values are hard-coded to match the contract types. Drift tests
 *   verify they stay in sync.
 */
export const agentTurnOutputJsonSchema = {
	$schema: 'https://json-schema.org/draft/2020-12/schema',
	additionalProperties: true as const,
	properties: {
		canonicalAnswerDraft: {
			anyOf: [
				{
					additionalProperties: false as const,
					properties: {
						confidence: {
							enum: [...CONFIDENCE_VALUES],
							type: 'string' as const,
						},
						content: { minLength: 1, type: 'string' as const },
						format: { enum: [...FORMAT_VALUES], type: 'string' as const },
						generatedAt: { minLength: 1, type: 'string' as const },
						generatedFromMessageIds: {
							items: { type: 'string' as const },
							type: 'array' as const,
						},
					},
					required: [
						'content',
						'format',
						'generatedAt',
						'generatedFromMessageIds',
						'confidence',
					] as readonly string[],
					type: 'object' as const,
				},
				{ type: 'null' as const },
			],
		},
		completenessEvaluation: {
			additionalProperties: false as const,
			properties: {
				blockingIssues: {
					items: { type: 'string' as const },
					type: 'array' as const,
				},
				complete: { type: 'boolean' as const },
				coverage: {
					additionalProperties: {
						enum: [...COVERAGE_VALUES],
						type: 'string' as const,
					},
					type: 'object' as const,
				},
				missing: {
					items: { type: 'string' as const },
					type: 'array' as const,
				},
				weak: {
					items: { type: 'string' as const },
					type: 'array' as const,
				},
			},
			required: [
				'complete',
				'coverage',
				'missing',
				'weak',
				'blockingIssues',
			] as readonly string[],
			type: 'object' as const,
		},
		diagnostics: {
			items: {
				additionalProperties: false as const,
				properties: {
					code: { minLength: 1, type: 'string' as const },
					details: { type: 'object' as const },
					message: { minLength: 1, type: 'string' as const },
					severity: {
						enum: [...SEVERITY_VALUES],
						type: 'string' as const,
					},
				},
				required: ['code', 'message', 'severity'] as readonly string[],
				type: 'object' as const,
			},
			type: 'array' as const,
		},
		extracted: {
			additionalProperties: false as const,
			properties: {
				assumptions: {
					items: { type: 'string' as const },
					type: 'array' as const,
				},
				decisions: {
					items: { type: 'string' as const },
					type: 'array' as const,
				},
				facts: {
					items: { type: 'string' as const },
					type: 'array' as const,
				},
				openQuestions: {
					items: { type: 'string' as const },
					type: 'array' as const,
				},
				risks: {
					items: { type: 'string' as const },
					type: 'array' as const,
				},
			},
			required: [
				'facts',
				'assumptions',
				'decisions',
				'risks',
				'openQuestions',
			] as readonly string[],
			type: 'object' as const,
		},
		proposedLifecycle: {
			enum: [...LIFECYCLE_VALUES],
			type: 'string' as const,
		},
		proposedPromptState: {
			enum: [...PROMPT_STATE_VALUES],
			type: 'string' as const,
		},
		suggestedActions: {
			items: {
				enum: [...ACTION_VALUES],
				type: 'string' as const,
			},
			type: 'array' as const,
		},
		transitionIntent: {
			anyOf: [
				{
					additionalProperties: false as const,
					properties: {
						event: {
							enum: [...TRANSITION_EVENT_VALUES],
							type: 'string' as const,
						},
						reason: { minLength: 1, type: 'string' as const },
					},
					required: ['event', 'reason'] as readonly string[],
					type: 'object' as const,
				},
				{ type: 'null' as const },
			],
		},
		userFacingMessage: { minLength: 1, type: 'string' as const },
	},
	required: ['userFacingMessage'] as readonly string[],
	type: 'object' as const,
} as const;
