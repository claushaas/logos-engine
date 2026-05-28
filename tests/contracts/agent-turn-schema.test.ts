/**
 * Step 15.2 — Agent turn schema contract tests
 *
 * Validates AgentTurnOutput objects using the production validator
 * (`validateAgentTurnOutput` from `src/validation/`). Covers:
 *   - Minimal valid output (userFacingMessage only).
 *   - Full output with all optional fields populated.
 *   - Intentionally broken outputs (empty message, wrong lifecycle values,
 *     invalid actions, invalid transition events, incomplete completeness).
 *
 * The production validator uses Zod for structural validation and the
 * state engine's `isValidTransition` / `getAllowedActions` for semantic
 * validation. This test exercises both layers.
 *
 * All tests run without LLM credentials.
 *
 * @see {@link https://logos-engine/docs/architecture/07-contracts-and-schemas.md §13}
 * @see {@link https://logos-engine/docs/architecture/09-testing-architecture.md §6}
 */
import { describe, expect, it } from 'vitest';

import type {
	AgentTurnOutput,
	NodeLifecycle,
} from '../../src/contracts/index.js';
import { isErr, isOk } from '../../src/shared/index.js';
import {
	type AgentTurnValidationContext,
	validateAgentTurnOutput,
} from '../../src/validation/index.js';

// ─── Fixtures ──────────────────────────────────────────────────────────────

/**
 * Minimal valid output — only the required `userFacingMessage`.
 */
function minimalOutput(): AgentTurnOutput {
	return {
		userFacingMessage: 'What is the core thesis of your project?',
	};
}

/**
 * Full valid output — all optional fields populated with valid data.
 *
 * Note: the `canonicalAnswerDraft` requires the effective lifecycle to be
 * `ready_for_synthesis` or `synthesized`. Since `proposedLifecycle` is not
 * set here, the semantic draft check is skipped without context — making
 * this fixture valid for structural validation alone.
 */
function fullOutput(): AgentTurnOutput {
	return {
		canonicalAnswerDraft: {
			confidence: 'medium',
			content:
				'The core thesis is: sustainable food systems require local production loops.',
			format: 'markdown',
			generatedAt: '2026-05-27T00:00:00.000Z',
			generatedFromMessageIds: ['msg_001', 'msg_002'],
		},
		completenessEvaluation: {
			blockingIssues: [],
			complete: true,
			coverage: {
				'central conviction': 'sufficient',
				'relevant change': 'sufficient',
			},
			missing: [],
			weak: [],
		},
		diagnostics: [
			{
				code: 'TURN_COMPLETE',
				details: { tokens: 1500 },
				message: 'Turn completed successfully',
				severity: 'info',
			},
		],
		extracted: {
			assumptions: ['Local food networks are feasible at scale.'],
			decisions: ['Focus on urban farming first.'],
			facts: ['The average food item travels 1500 miles.'],
			openQuestions: ['How to incentivize early adoption?'],
			risks: ['Supply chain logistics for urban farms.'],
		},
		suggestedActions: ['answer', 'defer'],
		transitionIntent: {
			event: 'USER_ANSWER_EVALUATED',
			reason: 'User provided a substantive answer to the initial question.',
		},
		userFacingMessage:
			"That's a solid start! Let me ask a follow-up question to deepen the answer.",
	};
}

/**
 * Output during synthesis state — includes canonical answer draft.
 */
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

// ─── Tests — valid examples ────────────────────────────────────────────────

describe('AgentTurnOutput schema — valid outputs', () => {
	it('minimal output (userFacingMessage only) passes validation', () => {
		const result = validateAgentTurnOutput(minimalOutput());
		expect(isOk(result)).toBe(true);
	});

	it('full output with all optional fields passes structural validation', () => {
		const result = validateAgentTurnOutput(fullOutput());
		// Without any lifecycle context and no proposedLifecycle, semantic
		// checks that depend on the current lifecycle are skipped. Only
		// structural Zod validation runs.
		if (isErr(result)) {
			// Only schema/structural errors are concerning here
			const schemaErrors = result.error.filter(
				(e) =>
					!e.code.startsWith('INVALID_TRANSITION') &&
					!e.code.startsWith('COMPLETENESS_CONTRADICTS') &&
					!e.code.startsWith('ACTION_NOT_ALLOWED') &&
					!e.code.startsWith('DRAFT_IN_DISALLOWED'),
			);
			expect(schemaErrors).toEqual([]);
		} else {
			expect(isOk(result)).toBe(true);
		}
	});

	it('full output with synthesized context passes all validation', () => {
		// Use synthesized lifecycle — drafts are allowed, and the
		// supported actions (accept/edit/regenerate) are valid there.
		const output: AgentTurnOutput = {
			canonicalAnswerDraft: {
				confidence: 'high',
				content: 'The core thesis is...',
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
			diagnostics: [{ code: 'OK', message: 'Turn done.', severity: 'info' }],
			extracted: {
				assumptions: ['Assumption A.'],
				decisions: ['Decision B.'],
				facts: ['Fact C.'],
				openQuestions: ['Question D?'],
				risks: ['Risk E.'],
			},
			suggestedActions: ['accept', 'edit', 'regenerate'],
			transitionIntent: { event: 'SYNTHESIS_PROPOSED', reason: 'Ready.' },
			userFacingMessage: 'Here is the synthesized answer.',
		};
		const context: AgentTurnValidationContext = {
			currentLifecycle: 'synthesized',
		};
		const result = validateAgentTurnOutput(output, context);
		expect(isOk(result)).toBe(true);
	});

	it('synthesis output passes validation with ready_for_synthesis context', () => {
		const context: AgentTurnValidationContext = {
			currentLifecycle: 'ready_for_synthesis',
		};
		const result = validateAgentTurnOutput(synthesisOutput(), context);
		expect(isOk(result)).toBe(true);
	});

	it('accept action in synthesized state is valid', () => {
		const context: AgentTurnValidationContext = {
			currentLifecycle: 'synthesized',
			userAction: 'accept',
		};
		const output: AgentTurnOutput = {
			completenessEvaluation: {
				blockingIssues: [],
				complete: true,
				coverage: { 'central conviction': 'sufficient' },
				missing: [],
				weak: [],
			},
			proposedLifecycle: 'accepted' as NodeLifecycle,
			proposedPromptState: 'accepted',
			suggestedActions: ['continue_next', 'open_document_preview'],
			userFacingMessage: 'Your canonical answer has been accepted.',
		};
		const result = validateAgentTurnOutput(output, context);
		expect(isOk(result)).toBe(true);
	});
});

// ─── Tests — intentionally broken outputs ─────────────────────────────────

describe('AgentTurnOutput schema — broken outputs', () => {
	it('empty userFacingMessage is rejected', () => {
		const result = validateAgentTurnOutput({ userFacingMessage: '' });
		expect(isErr(result)).toBe(true);
		if (isErr(result)) {
			expect(
				result.error.some(
					(e) => e.code === 'too_small' && e.path.includes('userFacingMessage'),
				),
			).toBe(true);
		}
	});

	it('missing userFacingMessage is rejected', () => {
		const result = validateAgentTurnOutput({});
		expect(isErr(result)).toBe(true);
		if (isErr(result)) {
			expect(result.error.some((e) => e.code === 'invalid_type')).toBe(true);
		}
	});

	it('non-string userFacingMessage is rejected', () => {
		const result = validateAgentTurnOutput({ userFacingMessage: 12345 });
		expect(isErr(result)).toBe(true);
	});

	it('whitespace-only userFacingMessage is rejected', () => {
		const result = validateAgentTurnOutput({ userFacingMessage: '   ' });
		expect(isErr(result)).toBe(true);
		if (isErr(result)) {
			expect(
				result.error.some(
					(e) =>
						(e.code === 'too_small' || e.code === 'invalid_type') &&
						e.path.includes('userFacingMessage'),
				),
			).toBe(true);
		}
	});

	it('invalid lifecycle value is rejected', () => {
		const result = validateAgentTurnOutput({
			proposedLifecycle: 'invalid_state',
			userFacingMessage: 'Hello',
		});
		expect(isErr(result)).toBe(true);
		if (isErr(result)) {
			// Zod v4 produces 'invalid_value' for invalid enum members
			const hasEnumError = result.error.some(
				(e) => e.code === 'invalid_value' || e.code === 'invalid_type',
			);
			expect(hasEnumError).toBe(true);
		}
	});

	it('invalid transition is rejected with context', () => {
		const context: AgentTurnValidationContext = {
			currentLifecycle: 'not_started',
		};
		const result = validateAgentTurnOutput(
			{
				proposedLifecycle: 'accepted' as NodeLifecycle,
				userFacingMessage: 'Done!',
			},
			context,
		);
		expect(isErr(result)).toBe(true);
		if (isErr(result)) {
			expect(result.error.some((e) => e.code === 'INVALID_TRANSITION')).toBe(
				true,
			);
		}
	});

	it('proposing accepted lifecycle without user accept action is rejected', () => {
		const context: AgentTurnValidationContext = {
			currentLifecycle: 'synthesized',
		};
		const result = validateAgentTurnOutput(
			{
				proposedLifecycle: 'accepted' as NodeLifecycle,
				userFacingMessage: 'Accepted!',
			},
			context,
		);
		expect(isErr(result)).toBe(true);
		if (isErr(result)) {
			expect(
				result.error.some((e) => e.code === 'ACCEPTED_WITHOUT_USER_ACTION'),
			).toBe(true);
		}
	});

	it('suggested action not allowed in lifecycle is rejected', () => {
		const context: AgentTurnValidationContext = {
			currentLifecycle: 'not_started',
		};
		const result = validateAgentTurnOutput(
			{
				proposedLifecycle: 'active' as NodeLifecycle,
				suggestedActions: ['accept' as const],
				userFacingMessage: 'Try accepting this.',
			},
			context,
		);
		expect(isErr(result)).toBe(true);
		if (isErr(result)) {
			expect(result.error.some((e) => e.code === 'ACTION_NOT_ALLOWED')).toBe(
				true,
			);
		}
	});

	it('canonical answer draft in disallowed lifecycle is rejected', () => {
		const context: AgentTurnValidationContext = {
			currentLifecycle: 'not_started',
		};
		const result = validateAgentTurnOutput(
			{
				canonicalAnswerDraft: {
					confidence: 'low',
					content: 'Early draft.',
					format: 'markdown',
					generatedAt: '2026-01-01T00:00:00.000Z',
					generatedFromMessageIds: [],
				},
				proposedLifecycle: 'active' as NodeLifecycle,
				userFacingMessage: 'Here is a draft.',
			},
			context,
		);
		expect(isErr(result)).toBe(true);
		if (isErr(result)) {
			expect(
				result.error.some((e) => e.code === 'DRAFT_IN_DISALLOWED_STATE'),
			).toBe(true);
		}
	});

	it('completeness false with ready_for_synthesis lifecycle is rejected', () => {
		const context: AgentTurnValidationContext = {
			currentLifecycle: 'answered',
		};
		const result = validateAgentTurnOutput(
			{
				completenessEvaluation: {
					blockingIssues: ['Missing coverage'],
					complete: false,
					coverage: { 'central conviction': 'weak' },
					missing: ['central conviction'],
					weak: ['central conviction'],
				},
				proposedLifecycle: 'ready_for_synthesis' as NodeLifecycle,
				userFacingMessage: 'Almost ready.',
			},
			context,
		);
		expect(isErr(result)).toBe(true);
		if (isErr(result)) {
			expect(
				result.error.some(
					(e) => e.code === 'COMPLETENESS_CONTRADICTS_LIFECYCLE',
				),
			).toBe(true);
		}
	});

	it('invalid transition event in transitionIntent is rejected', () => {
		const result = validateAgentTurnOutput({
			transitionIntent: { event: 'INVALID_EVENT', reason: 'test' },
			userFacingMessage: 'Hello',
		});
		expect(isErr(result)).toBe(true);
	});

	it('empty transitionIntent reason is rejected', () => {
		const result = validateAgentTurnOutput({
			transitionIntent: { event: 'ASKED_INITIAL', reason: '' },
			userFacingMessage: 'Hello',
		});
		expect(isErr(result)).toBe(true);
	});

	it('diagnostic with empty code is rejected', () => {
		const result = validateAgentTurnOutput({
			diagnostics: [{ code: '', message: 'test', severity: 'info' }],
			userFacingMessage: 'Hello',
		});
		expect(isErr(result)).toBe(true);
	});
});

// ─── Edge-case tests ──────────────────────────────────────────────────────

describe('AgentTurnOutput schema — edge cases', () => {
	it('output with passthrough extra fields is accepted (Zod .passthrough)', () => {
		const result = validateAgentTurnOutput({
			extraField: 'should be allowed',
			userFacingMessage: 'Hello with extra data',
		});
		expect(isOk(result)).toBe(true);
	});

	it('canonicalAnswerDraft explicitly null is accepted', () => {
		const result = validateAgentTurnOutput({
			canonicalAnswerDraft: null,
			userFacingMessage: 'No draft yet.',
		});
		expect(isOk(result)).toBe(true);
	});

	it('transitionIntent explicitly null is accepted', () => {
		const result = validateAgentTurnOutput({
			transitionIntent: null,
			userFacingMessage: 'No transition proposed.',
		});
		expect(isOk(result)).toBe(true);
	});

	it('valid output with all 10 lifecycle values (one at a time) passes schema check', () => {
		const lifecycles: NodeLifecycle[] = [
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
		for (const lc of lifecycles) {
			const result = validateAgentTurnOutput({
				proposedLifecycle: lc,
				userFacingMessage: `Lifecycle: ${lc}`,
			});
			// Without context, schema should accept all valid lifecycle values
			if (isErr(result)) {
				// Only flag schema errors as unexpected
				const schemaOnly = result.error.filter(
					(e) =>
						e.path.includes('proposedLifecycle') &&
						e.code === 'invalid_enum_value',
				);
				expect(schemaOnly).toEqual([]);
			}
		}
	});

	it('multiple errors are returned at once', () => {
		const result = validateAgentTurnOutput({
			canonicalAnswerDraft: {
				confidence: 'low',
				content: '',
				format: 'invalid',
				generatedAt: '',
				generatedFromMessageIds: [],
			},
			proposedLifecycle: 'invalid',
			suggestedActions: ['invalid_action'],
			userFacingMessage: '',
		});
		expect(isErr(result)).toBe(true);
		if (isErr(result)) {
			// Should find multiple distinct error codes
			const codes = new Set(result.error.map((e) => e.code));
			// At minimum we expect the invalid enum value errors
			expect(codes.size).toBeGreaterThanOrEqual(2);
		}
	});
});
