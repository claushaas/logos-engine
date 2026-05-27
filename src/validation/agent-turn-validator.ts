/**
 * AgentTurnOutput validator — the gatekeeper that prevents LLM output
 * from corrupting runtime state.
 *
 * Every LLM agent turn produces an `AgentTurnOutput`. Before the state
 * engine applies any effects, this validator runs:
 *
 * 1. **Schema-level validation** via Zod (structural & type checks).
 * 2. **Semantic validation** (lifecycle transitions, action compatibility,
 *    draft rules, completeness constraints).
 *
 * The validator returns ALL errors at once — it does not short-circuit
 * on the first failure.
 *
 * @see {@link https://logos-engine/docs/06-agent-turn-contract.md §10}
 * @see {@link https://logos-engine/docs/architecture/05-llm-integration-architecture.md §6}
 */
import z from 'zod';

import type {
	AgentTurnOutput,
	NodeAction,
	NodeLifecycle,
	PromptState,
	TransitionEvent,
} from '../contracts/index.js';
import type { Result } from '../shared/index.js';
import { err, ok } from '../shared/index.js';

import { getAllowedActions } from '../state-engine/allowed-actions.js';
import { isValidTransition } from '../state-engine/node-lifecycle.js';

// ═══════════════════════════════════════════════════════════════════════════
// Public types
// ═══════════════════════════════════════════════════════════════════════════

/**
 * A single validation error with a machine-readable code, human-readable
 * message, and path to the offending field.
 */
export type ValidationError = {
	/** Machine-readable error code (e.g. `'INVALID_TRANSITION'`). */
	readonly code: string;

	/** Human-readable description of what went wrong. */
	readonly message: string;

	/** Path to the offending field (e.g. `['proposedLifecycle']`). */
	readonly path: readonly (string | number)[];
};

/**
 * Optional context passed to `validateAgentTurnOutput` to enable
 * semantic checks that depend on the current node state.
 *
 * When absent, only schema-level validation runs.
 */
export type AgentTurnValidationContext = {
	/** The node's current lifecycle state. */
	readonly currentLifecycle: NodeLifecycle;

	/** The user action that triggered this validation, if any. */
	readonly userAction?: NodeAction;
};

// ═══════════════════════════════════════════════════════════════════════════
// Zod schemas — structural validation of every sub-type
// ═══════════════════════════════════════════════════════════════════════════

// ── Literal constants (kept in sync with contract types) ────────────────────

const LIFECYCLE_VALUES = [
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
] as const satisfies readonly NodeLifecycle[];

const PROMPT_STATE_VALUES = [
	'initial',
	'follow_up',
	'clarification',
	'refinement',
	'synthesis',
	'review',
	'repair',
	'blocked',
	'accepted',
] as const satisfies readonly PromptState[];

const ACTION_VALUES = [
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
] as const satisfies readonly NodeAction[];

const TRANSITION_EVENT_VALUES = [
	'ASKED_INITIAL',
	'USER_ANSWER_EVALUATED',
	'CLARIFICATION_REQUESTED',
	'REFINEMENT_REQUESTED',
	'SYNTHESIS_PROPOSED',
	'REVIEW_REQUESTED',
	'NODE_BLOCKED',
	'NODE_READY_FOR_ACCEPTANCE',
] as const satisfies readonly TransitionEvent[];

const CONFIDENCE_VALUES = ['low', 'medium', 'high'] as const;
const FORMAT_VALUES = ['markdown', 'structured'] as const;
const SEVERITY_VALUES = ['info', 'warning', 'error'] as const;
const COVERAGE_VALUES = ['missing', 'weak', 'sufficient'] as const;

// ── Sub-type schemas ────────────────────────────────────────────────────────

/**
 * CanonicalAnswerDraft schema — validates all required fields per the
 * contract type in `src/contracts/canonical-answer.ts`.
 *
 * Note: the contract code types take precedence over older doc versions.
 * The actual required fields are `content`, `format`, `generatedAt`,
 * `generatedFromMessageIds`, and `confidence`.
 */
const canonicalAnswerDraftSchema = z.object({
	confidence: z.enum(CONFIDENCE_VALUES),
	content: z.string().min(1),
	format: z.enum(FORMAT_VALUES),
	generatedAt: z.string().min(1),
	generatedFromMessageIds: z.array(z.string()),
});

/** CompletenessState schema. */
const completenessStateSchema = z.object({
	blockingIssues: z.array(z.string()),
	complete: z.boolean(),
	coverage: z.record(z.string(), z.enum(COVERAGE_VALUES)),
	missing: z.array(z.string()),
	weak: z.array(z.string()),
});

/** ExtractedNodeData schema. */
const extractedNodeDataSchema = z.object({
	assumptions: z.array(z.string()),
	decisions: z.array(z.string()),
	facts: z.array(z.string()),
	openQuestions: z.array(z.string()),
	risks: z.array(z.string()),
});

/** TransitionIntent schema — `event` and `reason` are both required. */
const transitionIntentSchema = z.object({
	event: z.enum(TRANSITION_EVENT_VALUES),
	reason: z.string().trim().min(1),
});

/** AgentDiagnostic schema. */
const agentDiagnosticSchema = z.object({
	code: z.string().min(1),
	details: z.record(z.string(), z.unknown()).optional(),
	message: z.string().min(1),
	severity: z.enum(SEVERITY_VALUES),
});

// ── Top-level AgentTurnOutput schema ────────────────────────────────────────

/**
 * Full AgentTurnOutput schema.
 *
 * `userFacingMessage` is the only required field. All other fields are
 * optional and context-dependent. `.passthrough()` allows the LLM to
 * include extra metadata without causing validation failures.
 */
const agentTurnOutputSchema = z
	.object({
		canonicalAnswerDraft: canonicalAnswerDraftSchema.nullable().optional(),
		completenessEvaluation: completenessStateSchema.optional(),
		diagnostics: z.array(agentDiagnosticSchema).optional(),
		extracted: extractedNodeDataSchema.optional(),
		proposedLifecycle: z.enum(LIFECYCLE_VALUES).optional(),
		proposedPromptState: z.enum(PROMPT_STATE_VALUES).optional(),
		suggestedActions: z.array(z.enum(ACTION_VALUES)).optional(),
		transitionIntent: transitionIntentSchema.nullable().optional(),
		userFacingMessage: z.string().trim().min(1),
	})
	.passthrough();

// ═══════════════════════════════════════════════════════════════════════════
// Zod issue → ValidationError conversion
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Convert Zod issues to the project's `ValidationError` type.
 */
function zodIssuesToValidationErrors(
	issues: ReadonlyArray<z.ZodIssue>,
): ValidationError[] {
	return issues.map((issue) => ({
		code: issue.code,
		message: issue.message,
		// Zod path is PropertyKey[] — filter to (string | number) only.
		path: issue.path.filter(
			(p): p is string | number =>
				typeof p === 'string' || typeof p === 'number',
		),
	}));
}

// ═══════════════════════════════════════════════════════════════════════════
// Semantic checks
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Lifecycle states in which a canonical answer draft is allowed.
 *
 * Drafts may only be proposed during synthesis and review states.
 */
const DRAFT_ALLOWED_LIFECYCLES: ReadonlySet<NodeLifecycle> = new Set([
	'ready_for_synthesis',
	'synthesized',
]);

/**
 * Lifecycle states that require a `complete` completeness evaluation.
 *
 * Proposing these states with `complete: false` is a contradiction.
 */
const COMPLETE_REQUIRED_LIFECYCLES: ReadonlySet<NodeLifecycle> = new Set([
	'ready_for_synthesis',
	'synthesized',
	'accepted',
]);

/**
 * Run all semantic validation checks on a successfully-parsed
 * `AgentTurnOutput`.
 *
 * Returns all errors found — never short-circuits on the first.
 */
function runSemanticChecks(
	data: AgentTurnOutput,
	context: AgentTurnValidationContext | undefined,
): ValidationError[] {
	const errors: ValidationError[] = [];

	// Determine the effective lifecycle for checks that compare against
	// the "current" state. `proposedLifecycle` takes priority when both
	// are present because the LLM is asserting its intended state.
	const effectiveLifecycle: NodeLifecycle | undefined =
		data.proposedLifecycle ?? context?.currentLifecycle;

	// ── 1. Proposed lifecycle transition validity ────────────────────
	if (context?.currentLifecycle && data.proposedLifecycle !== undefined) {
		if (!isValidTransition(context.currentLifecycle, data.proposedLifecycle)) {
			errors.push({
				code: 'INVALID_TRANSITION',
				message: `Cannot transition from "${context.currentLifecycle}" to "${data.proposedLifecycle}": transition is not permitted by the lifecycle state machine`,
				path: ['proposedLifecycle'],
			});
		}
	}

	// ── 2. "accepted" lifecycle requires explicit user accept ────────
	if (data.proposedLifecycle === 'accepted') {
		if (!context || context.userAction !== 'accept') {
			errors.push({
				code: 'ACCEPTED_WITHOUT_USER_ACTION',
				message:
					'Cannot propose "accepted" lifecycle without an explicit user accept action. Only the user may accept a node.',
				path: ['proposedLifecycle'],
			});
		}
	}

	// ── 3. CanonicalAnswerDraft in disallowed lifecycle ─────────────
	if (data.canonicalAnswerDraft != null) {
		if (
			effectiveLifecycle !== undefined &&
			!DRAFT_ALLOWED_LIFECYCLES.has(effectiveLifecycle)
		) {
			const lifecycleName = data.proposedLifecycle ?? context?.currentLifecycle;
			errors.push({
				code: 'DRAFT_IN_DISALLOWED_STATE',
				message: `Canonical answer draft may only be proposed during synthesis or review. Lifecycle "${lifecycleName}" does not allow draft generation.`,
				path: ['canonicalAnswerDraft'],
			});
		}
	}

	// ── 4. Suggested actions must be compatible with lifecycle ──────
	if (data.suggestedActions && data.suggestedActions.length > 0) {
		const actionsLifecycle =
			data.proposedLifecycle ?? context?.currentLifecycle;

		if (actionsLifecycle !== undefined) {
			const allowed = new Set(getAllowedActions(actionsLifecycle));
			for (const action of data.suggestedActions) {
				if (!allowed.has(action)) {
					errors.push({
						code: 'ACTION_NOT_ALLOWED',
						message: `Action "${action}" is not allowed in lifecycle "${actionsLifecycle}"`,
						path: ['suggestedActions'],
					});
				}
			}
		}
	}

	// ── 5. Completeness must not contradict lifecycle ───────────────
	if (
		data.completenessEvaluation &&
		data.completenessEvaluation.complete === false
	) {
		if (
			effectiveLifecycle !== undefined &&
			COMPLETE_REQUIRED_LIFECYCLES.has(effectiveLifecycle)
		) {
			errors.push({
				code: 'COMPLETENESS_CONTRADICTS_LIFECYCLE',
				message: `Lifecycle "${effectiveLifecycle}" requires a complete evaluation, but completeness is false`,
				path: ['completenessEvaluation'],
			});
		}
	}

	return errors;
}

// ═══════════════════════════════════════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Validate an LLM-generated `AgentTurnOutput` against the contract.
 *
 * Runs two phases:
 * 1. **Schema validation** — structural checks via Zod (required fields,
 *    enum values, types).
 * 2. **Semantic validation** — lifecycle transition legality, action
 *    compatibility, draft rules, and completeness constraints.
 *
 * Returns ALL validation errors (not just the first). When `context` is
 * omitted, semantic checks that depend on current node state are
 * skipped, but checks using `proposedLifecycle` always run.
 *
 * @param output  - The raw LLM output to validate (any shape).
 * @param context - Optional current node state for semantic checks.
 * @returns `ok(AgentTurnOutput)` on success, or `err(ValidationError[])`
 *   with every discovered issue.
 *
 * @example
 * ```ts
 * const result = validateAgentTurnOutput(rawLlmOutput, {
 *   currentLifecycle: 'active',
 * });
 *
 * if (isErr(result)) {
 *   for (const e of result.error) {
 *     console.error(`${e.code}: ${e.message}`);
 *   }
 * }
 * ```
 */
export function validateAgentTurnOutput(
	output: unknown,
	context?: AgentTurnValidationContext,
): Result<AgentTurnOutput, ValidationError[]> {
	const errors: ValidationError[] = [];

	// ── Phase 1: Schema validation via Zod ───────────────────────────
	const parsed = agentTurnOutputSchema.safeParse(output);

	if (!parsed.success) {
		return err(zodIssuesToValidationErrors(parsed.error.issues));
	}

	const data = parsed.data as AgentTurnOutput;

	// ── Phase 2: Semantic validation ─────────────────────────────────
	errors.push(...runSemanticChecks(data, context));

	// ── Combine results ──────────────────────────────────────────────
	if (errors.length > 0) {
		return err(errors);
	}

	return ok(data);
}
