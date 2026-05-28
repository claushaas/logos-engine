/**
 * Drift tests between the canonical `AgentTurnOutput` JSON Schema
 * and the Zod-based `validateAgentTurnOutput` semantic validator.
 *
 * ## Purpose
 *
 * The JSON Schema (`agentTurnOutputJsonSchema`) constrains provider output
 * at the structural level. The semantic validator (`validateAgentTurnOutput`)
 * is the final authority — it runs Zod structural checks AND lifecycle,
 * action-compatibility, draft-rule, and completeness-semantic checks.
 *
 * These tests verify that the two schemas agree on representative cases.
 * When they disagree (e.g., a case that passes JSON Schema but fails
 * semantic validation due to lifecycle context), the disagreement is
 * documented.
 *
 * @see {@link https://logos-engine/docs/15-real-llm-implementation-roadmap.md §LLM-02}
 */
import { describe, expect, it } from 'vitest';
import z from 'zod';

import { agentTurnOutputJsonSchema } from '../../src/contracts/agent-turn.schema.js';
import type {
	AgentTurnOutput,
	NodeLifecycle,
} from '../../src/contracts/index.js';
import { isErr, isOk } from '../../src/shared/index.js';
import {
	type AgentTurnValidationContext,
	validateAgentTurnOutput,
} from '../../src/validation/index.js';

// ═══════════════════════════════════════════════════════════════════════════
// Convert JSON Schema to Zod for drift validation
// ═══════════════════════════════════════════════════════════════════════════

/**
 * A Zod schema derived from the canonical JSON Schema.
 *
 * This is the "JSON Schema side" of the drift comparison. Using
 * `z.fromJSONSchema()` ensures we validate against the exact same
 * structural rules that a provider would enforce.
 */
const jsonSchemaValidator = z.fromJSONSchema(
	// Cast needed because `fromJSONSchema` expects a mutable schema object
	// but our exported constant uses `as const` for type safety.
	agentTurnOutputJsonSchema as Record<string, unknown>,
);

// ═══════════════════════════════════════════════════════════════════════════
// Test fixtures
// ═══════════════════════════════════════════════════════════════════════════

/** Minimal valid output — only the required `userFacingMessage`. */
function minimalOutput(): AgentTurnOutput {
	return {
		userFacingMessage: 'What is the core thesis of your project?',
	};
}

/** Synthesis output — all fields populated for a synthesis-compatible state. */
function synthesisOutput(): AgentTurnOutput {
	return {
		canonicalAnswerDraft: {
			confidence: 'high',
			content: '## Core Thesis\n\nThe project exists because...',
			format: 'markdown',
			generatedAt: '2026-05-27T00:00:00.000Z',
			generatedFromMessageIds: ['msg_001', 'msg_002', 'msg_003'],
		},
		completenessEvaluation: {
			blockingIssues: [],
			complete: true,
			coverage: {
				'central conviction': 'sufficient',
			},
			missing: [],
			weak: [],
		},
		proposedLifecycle: 'synthesized',
		proposedPromptState: 'review',
		suggestedActions: ['accept', 'edit', 'regenerate'],
		transitionIntent: {
			event: 'SYNTHESIS_PROPOSED',
			reason: 'All coverage topics are sufficient. Ready for review.',
		},
		userFacingMessage:
			"Here's the synthesized canonical answer for your review.",
	};
}

/** Output with `canonicalAnswerDraft: null` (explicit no-draft). */
function nullDraftOutput(): AgentTurnOutput {
	return {
		canonicalAnswerDraft: null,
		userFacingMessage: 'No draft available yet.',
	};
}

/** Output with `transitionIntent: null` (explicit no-transition). */
function nullTransitionOutput(): AgentTurnOutput {
	return {
		transitionIntent: null,
		userFacingMessage: 'No transition proposed.',
	};
}

/** Output with extra passthrough fields. */
function passthroughOutput(): AgentTurnOutput {
	return {
		extraField: 'should be allowed',
		userFacingMessage: 'Hello with extra data',
	} as AgentTurnOutput;
}

/** Context for synthesis-compatible semantic checks. */
const SYNTHESIS_CONTEXT: AgentTurnValidationContext = {
	currentLifecycle: 'ready_for_synthesis',
};

// ═══════════════════════════════════════════════════════════════════════════
// Tests — valid outputs
// ═══════════════════════════════════════════════════════════════════════════

describe('AgentTurnOutput JSON Schema — valid outputs', () => {
	it('minimal output passes JSON Schema and semantic validation', () => {
		const output = minimalOutput();

		const jsonResult = jsonSchemaValidator.safeParse(output);
		const semanticResult = validateAgentTurnOutput(output);

		expect(jsonResult.success).toBe(true);
		expect(isOk(semanticResult)).toBe(true);
	});

	it('synthesis output passes JSON Schema and semantic validation (synthesis context)', () => {
		const output = synthesisOutput();

		const jsonResult = jsonSchemaValidator.safeParse(output);

		// With synthesis context, semantic validation should succeed
		// because the lifecycle and actions are compatible.
		const semanticResult = validateAgentTurnOutput(output, SYNTHESIS_CONTEXT);

		expect(jsonResult.success).toBe(true);
		expect(isOk(semanticResult)).toBe(true);
	});

	it('canonicalAnswerDraft: null passes JSON Schema', () => {
		const output = nullDraftOutput();

		const jsonResult = jsonSchemaValidator.safeParse(output);

		expect(jsonResult.success).toBe(true);
	});

	it('transitionIntent: null passes JSON Schema', () => {
		const output = nullTransitionOutput();

		const jsonResult = jsonSchemaValidator.safeParse(output);

		expect(jsonResult.success).toBe(true);
	});

	it('extra passthrough fields are accepted by JSON Schema (additionalProperties: true)', () => {
		const output = passthroughOutput();

		const jsonResult = jsonSchemaValidator.safeParse(output);

		expect(jsonResult.success).toBe(true);
	});

	it('output with all optional fields populated passes JSON Schema', () => {
		const output: AgentTurnOutput = {
			canonicalAnswerDraft: {
				confidence: 'medium',
				content: 'The core thesis is: sustainable food systems.',
				format: 'markdown',
				generatedAt: '2026-05-27T00:00:00.000Z',
				generatedFromMessageIds: ['msg_001'],
			},
			completenessEvaluation: {
				blockingIssues: [],
				complete: true,
				coverage: { 'central conviction': 'sufficient' },
				missing: [],
				weak: [],
			},
			diagnostics: [
				{
					code: 'OK',
					details: { tokens: 500 },
					message: 'Turn complete',
					severity: 'info',
				},
			],
			extracted: {
				assumptions: ['Assumption A.'],
				decisions: ['Decision B.'],
				facts: ['Fact C.'],
				openQuestions: ['Question D?'],
				risks: ['Risk E.'],
			},
			proposedLifecycle: 'synthesized',
			proposedPromptState: 'review',
			suggestedActions: ['accept', 'edit', 'regenerate'],
			transitionIntent: {
				event: 'SYNTHESIS_PROPOSED',
				reason: 'Ready for review.',
			},
			userFacingMessage: 'Here is the full output.',
		};

		const jsonResult = jsonSchemaValidator.safeParse(output);
		expect(jsonResult.success).toBe(true);
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// Tests — invalid structural outputs (should fail BOTH)
// ═══════════════════════════════════════════════════════════════════════════

describe('AgentTurnOutput JSON Schema — invalid outputs', () => {
	it('empty userFacingMessage fails JSON Schema and semantic validation', () => {
		const output = { userFacingMessage: '' };

		const jsonResult = jsonSchemaValidator.safeParse(output);
		const semanticResult = validateAgentTurnOutput(output);

		expect(jsonResult.success).toBe(false);
		expect(isErr(semanticResult)).toBe(true);
	});

	it('missing userFacingMessage fails JSON Schema and semantic validation', () => {
		const output = {};

		const jsonResult = jsonSchemaValidator.safeParse(output);
		const semanticResult = validateAgentTurnOutput(output);

		expect(jsonResult.success).toBe(false);
		expect(isErr(semanticResult)).toBe(true);
	});

	it('invalid lifecycle value fails JSON Schema and semantic validation', () => {
		const output = {
			proposedLifecycle: 'invalid_state',
			userFacingMessage: 'Hello',
		};

		const jsonResult = jsonSchemaValidator.safeParse(output);
		const semanticResult = validateAgentTurnOutput(output);

		expect(jsonResult.success).toBe(false);
		expect(isErr(semanticResult)).toBe(true);
	});

	it('invalid prompt state value fails JSON Schema and semantic validation', () => {
		const output = {
			proposedPromptState: 'invalid_prompt_state',
			userFacingMessage: 'Hello',
		};

		const jsonResult = jsonSchemaValidator.safeParse(output);
		const semanticResult = validateAgentTurnOutput(output);

		expect(jsonResult.success).toBe(false);
		expect(isErr(semanticResult)).toBe(true);
	});

	it('invalid suggested action fails JSON Schema and semantic validation', () => {
		const output = {
			suggestedActions: ['invalid_action'],
			userFacingMessage: 'Hello',
		};

		const jsonResult = jsonSchemaValidator.safeParse(output);
		const semanticResult = validateAgentTurnOutput(output);

		expect(jsonResult.success).toBe(false);
		expect(isErr(semanticResult)).toBe(true);
	});

	it('invalid transition event fails JSON Schema and semantic validation', () => {
		const output = {
			transitionIntent: { event: 'INVALID_EVENT', reason: 'test' },
			userFacingMessage: 'Hello',
		};

		const jsonResult = jsonSchemaValidator.safeParse(output);
		const semanticResult = validateAgentTurnOutput(output);

		expect(jsonResult.success).toBe(false);
		expect(isErr(semanticResult)).toBe(true);
	});

	it('empty transitionIntent reason fails JSON Schema (minLength: 1)', () => {
		const output = {
			transitionIntent: { event: 'ASKED_INITIAL', reason: '' },
			userFacingMessage: 'Hello',
		};

		const jsonResult = jsonSchemaValidator.safeParse(output);

		expect(jsonResult.success).toBe(false);
	});

	it('canonicalAnswerDraft with empty content fails JSON Schema', () => {
		const output = {
			canonicalAnswerDraft: {
				confidence: 'low',
				content: '',
				format: 'markdown',
				generatedAt: '2026-01-01T00:00:00.000Z',
				generatedFromMessageIds: [],
			},
			userFacingMessage: 'Hello',
		};

		const jsonResult = jsonSchemaValidator.safeParse(output);

		expect(jsonResult.success).toBe(false);
	});

	it('missing required field in canonicalAnswerDraft fails JSON Schema', () => {
		const output = {
			canonicalAnswerDraft: {
				// Missing 'content', 'format', 'generatedAt', etc.
				confidence: 'low',
			},
			userFacingMessage: 'Hello',
		};

		const jsonResult = jsonSchemaValidator.safeParse(output);

		expect(jsonResult.success).toBe(false);
	});

	it('diagnostic with empty code fails JSON Schema (minLength: 1)', () => {
		const output = {
			diagnostics: [{ code: '', message: 'test', severity: 'info' }],
			userFacingMessage: 'Hello',
		};

		const jsonResult = jsonSchemaValidator.safeParse(output);

		expect(jsonResult.success).toBe(false);
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// Tests — documented disagreements
// ═══════════════════════════════════════════════════════════════════════════
//
// These tests document cases where the JSON Schema and the semantic
// validator disagree. In all cases the semantic validator is the final
// authority.
//
// Disagreement categories:
//
// A) Semantic context required — the JSON Schema cannot express lifecycle
//    transition rules, action compatibility, draft-state constraints, or
//    completeness contradictions. These are structural passes but
//    semantic failures.
//
// B) String processing — JSON Schema `minLength` counts raw characters;
//    Zod `.trim().min(1)` strips whitespace first. Whitespace-only
//    strings pass JSON Schema but fail the Zod validator.
// ═══════════════════════════════════════════════════════════════════════

describe('AgentTurnOutput — JSON Schema / Semantic validator disagreements', () => {
	// ── Category B: String processing ────────────────────────────────

	it('[DISAGREEMENT] whitespace-only userFacingMessage passes JSON Schema but fails Zod validator', () => {
		// JSON Schema `minLength: 1` counts raw characters — "   " has
		// length 3 and passes. The Zod validator uses `.trim().min(1)`
		// which strips whitespace first — "   " trims to "" and fails.
		// The Zod validator is the authoritative result.
		const output = { userFacingMessage: '   ' };

		const jsonResult = jsonSchemaValidator.safeParse(output);
		const zodResult = validateAgentTurnOutput(output);

		// JSON Schema passes — 3 characters ≥ 1.
		expect(jsonResult.success).toBe(true);

		// Zod validator rejects — trimmed string is empty.
		expect(isErr(zodResult)).toBe(true);
	});

	// ── Category A: Semantic context required ────────────────────────
	it('canonicalAnswerDraft in disallowed lifecycle passes JSON Schema but fails semantic validation', () => {
		// The JSON Schema cares only about structural validity.
		// The semantic validator checks lifecycle context: drafts are
		// only allowed in `ready_for_synthesis` and `synthesized`.
		const output: AgentTurnOutput = {
			canonicalAnswerDraft: {
				confidence: 'low',
				content: 'Early draft.',
				format: 'markdown',
				generatedAt: '2026-01-01T00:00:00.000Z',
				generatedFromMessageIds: [],
			},
			proposedLifecycle: 'active' as NodeLifecycle,
			userFacingMessage: 'Here is a draft.',
		};

		const jsonResult = jsonSchemaValidator.safeParse(output);
		const semanticResult = validateAgentTurnOutput(output, {
			currentLifecycle: 'not_started',
		});

		// JSON Schema passes — the object is structurally valid.
		expect(jsonResult.success).toBe(true);

		// Semantic validator rejects — draft in disallowed lifecycle.
		expect(isErr(semanticResult)).toBe(true);
		if (isErr(semanticResult)) {
			expect(
				semanticResult.error.some(
					(e) => e.code === 'DRAFT_IN_DISALLOWED_STATE',
				),
			).toBe(true);
		}
	});

	it('proposing accepted lifecycle without user action passes JSON Schema but fails semantic', () => {
		// JSON Schema: `accepted` is a valid lifecycle enum value.
		// Semantic validator: only the user may accept a node.
		const output: AgentTurnOutput = {
			proposedLifecycle: 'accepted' as NodeLifecycle,
			userFacingMessage: 'Accepted!',
		};

		const jsonResult = jsonSchemaValidator.safeParse(output);
		const semanticResult = validateAgentTurnOutput(output, {
			currentLifecycle: 'synthesized',
		});

		// JSON Schema passes — structurally valid.
		expect(jsonResult.success).toBe(true);

		// Semantic validator rejects — no user accept action.
		expect(isErr(semanticResult)).toBe(true);
		if (isErr(semanticResult)) {
			expect(
				semanticResult.error.some(
					(e) => e.code === 'ACCEPTED_WITHOUT_USER_ACTION',
				),
			).toBe(true);
		}
	});

	it('action not allowed in lifecycle passes JSON Schema but fails semantic validation', () => {
		// JSON Schema: 'accept' is a valid action enum value.
		// Semantic validator: 'accept' is not allowed in 'not_started'.
		const output: AgentTurnOutput = {
			proposedLifecycle: 'active' as NodeLifecycle,
			suggestedActions: ['accept' as const],
			userFacingMessage: 'Try accepting this.',
		};

		const jsonResult = jsonSchemaValidator.safeParse(output);
		const semanticResult = validateAgentTurnOutput(output, {
			currentLifecycle: 'not_started',
		});

		// JSON Schema passes — 'accept' is a valid enum value.
		expect(jsonResult.success).toBe(true);

		// Semantic validator rejects — action not allowed.
		expect(isErr(semanticResult)).toBe(true);
		if (isErr(semanticResult)) {
			expect(
				semanticResult.error.some((e) => e.code === 'ACTION_NOT_ALLOWED'),
			).toBe(true);
		}
	});

	it('invalid lifecycle transition passes JSON Schema but fails semantic validation', () => {
		// JSON Schema: both 'not_started' and 'accepted' are valid enum values.
		// Semantic validator: cannot transition from 'not_started' to 'accepted'.
		const output: AgentTurnOutput = {
			proposedLifecycle: 'accepted' as NodeLifecycle,
			userFacingMessage: 'Done!',
		};

		const jsonResult = jsonSchemaValidator.safeParse(output);
		const semanticResult = validateAgentTurnOutput(output, {
			currentLifecycle: 'not_started',
		});

		// JSON Schema passes — both values are valid enum members.
		expect(jsonResult.success).toBe(true);

		// Semantic validator rejects — illegal transition.
		expect(isErr(semanticResult)).toBe(true);
		if (isErr(semanticResult)) {
			expect(
				semanticResult.error.some((e) => e.code === 'INVALID_TRANSITION'),
			).toBe(true);
		}
	});

	it('completeness contradiction passes JSON Schema but fails semantic validation', () => {
		// JSON Schema: `complete: false` and `ready_for_synthesis` are
		// both structurally valid. Semantic validator: you cannot propose
		// `ready_for_synthesis` with `complete: false`.
		const output: AgentTurnOutput = {
			completenessEvaluation: {
				blockingIssues: ['Missing coverage'],
				complete: false,
				coverage: { 'central conviction': 'weak' },
				missing: ['central conviction'],
				weak: ['central conviction'],
			},
			proposedLifecycle: 'ready_for_synthesis' as NodeLifecycle,
			userFacingMessage: 'Almost ready.',
		};

		const jsonResult = jsonSchemaValidator.safeParse(output);
		const semanticResult = validateAgentTurnOutput(output, {
			currentLifecycle: 'answered',
		});

		// JSON Schema passes — structurally valid.
		expect(jsonResult.success).toBe(true);

		// Semantic validator rejects — completeness contradicts lifecycle.
		expect(isErr(semanticResult)).toBe(true);
		if (isErr(semanticResult)) {
			expect(
				semanticResult.error.some(
					(e) => e.code === 'COMPLETENESS_CONTRADICTS_LIFECYCLE',
				),
			).toBe(true);
		}
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// Enum value sync checks
// ═══════════════════════════════════════════════════════════════════════════

describe('AgentTurnOutput JSON Schema — enum value sync', () => {
	it('all lifecycle values are in the JSON Schema enum', () => {
		const schema = agentTurnOutputJsonSchema as Record<string, unknown>;
		const props = schema.properties as Record<string, unknown>;
		const lifecycleEnum = (
			(props.proposedLifecycle as Record<string, unknown>).enum as string[]
		).slice();

		// All expected lifecycle values should be present.
		const expected: NodeLifecycle[] = [
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

		for (const val of expected) {
			expect(lifecycleEnum).toContain(val);
		}
		expect(lifecycleEnum.length).toBe(expected.length);
	});

	it('all prompt state values are in the JSON Schema enum', () => {
		const schema = agentTurnOutputJsonSchema as Record<string, unknown>;
		const props = schema.properties as Record<string, unknown>;
		const promptStateEnum = (
			(props.proposedPromptState as Record<string, unknown>).enum as string[]
		).slice();

		const expected = [
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

		for (const val of expected) {
			expect(promptStateEnum).toContain(val);
		}
		expect(promptStateEnum.length).toBe(expected.length);
	});

	it('all action values are in the JSON Schema enum', () => {
		const schema = agentTurnOutputJsonSchema as Record<string, unknown>;
		const props = schema.properties as Record<string, unknown>;
		const actionEnum = (
			(props.suggestedActions as Record<string, unknown>).items as Record<
				string,
				unknown
			>
		).enum as string[];

		const expected = [
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

		for (const val of expected) {
			expect(actionEnum).toContain(val);
		}
		expect(actionEnum.length).toBe(expected.length);
	});

	it('all transition event values are in the JSON Schema enum', () => {
		const schema = agentTurnOutputJsonSchema as Record<string, unknown>;
		const props = schema.properties as Record<string, unknown>;
		const tiProp = props.transitionIntent as Record<string, unknown>;
		const anyOf = tiProp.anyOf as Record<string, unknown>[];
		const objectSchema = anyOf[0]! as Record<string, unknown>;
		const eventProp = objectSchema.properties as Record<string, unknown>;
		const eventEnum = eventProp.event as Record<string, unknown>;
		const values = eventEnum.enum as string[];

		const expected = [
			'ASKED_INITIAL',
			'USER_ANSWER_EVALUATED',
			'CLARIFICATION_REQUESTED',
			'REFINEMENT_REQUESTED',
			'SYNTHESIS_PROPOSED',
			'REVIEW_REQUESTED',
			'NODE_BLOCKED',
			'NODE_READY_FOR_ACCEPTANCE',
		];

		for (const val of expected) {
			expect(values).toContain(val);
		}
		expect(values.length).toBe(expected.length);
	});
});
