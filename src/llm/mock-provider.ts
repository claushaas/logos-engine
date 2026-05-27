/**
 * Mock LLM provider — returns predetermined AgentTurnOutput fixtures
 * keyed by node lifecycle, enabling development and testing without
 * real LLM credentials or network access.
 *
 * @see {@link https://logos-engine/docs/architecture/05-llm-integration-architecture.md §11}
 * @see {@link https://logos-engine/docs/architecture/09-testing-architecture.md §8}
 * @see {@link https://logos-engine/docs/13-prototypes.md §6.7}
 */
import type {
	AgentTurnOutput,
	CanonicalAnswerDraft,
	NodeLifecycle,
} from '../contracts/index.js';
import type { LlmRequest } from '../prompt-orchestration/prompt-assembler.js';

// ═══════════════════════════════════════════════════════════════════════════
// Public types
// ═══════════════════════════════════════════════════════════════════════════

/**
 * The structured output returned by an {@link LlmProvider}.
 *
 * In the mock provider this *is* the `AgentTurnOutput` directly.
 * Real providers would wrap the raw output with usage metadata,
 * but the validated final product is always `AgentTurnOutput`.
 */
export type LlmResponse = AgentTurnOutput;

/**
 * Provider-agnostic LLM adapter interface.
 *
 * Every provider (real, mock, fallback) implements this contract.
 * The state engine consumes `LlmResponse` and validates it with
 * {@link validateAgentTurnOutput} before applying effects.
 *
 * @see {@link https://logos-engine/docs/architecture/05-llm-integration-architecture.md §3}
 */
export interface LlmProvider {
	/**
	 * Generate a structured `AgentTurnOutput` from the assembled request.
	 *
	 * The provider may use any strategy (real LLM, fixture lookup,
	 * deterministic heuristic) but must return output conforming to
	 * the `AgentTurnOutput` contract.
	 */
	generateStructuredOutput(request: LlmRequest): Promise<LlmResponse>;
}

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

/**
 * All valid {@link NodeLifecycle} values.
 *
 * Used for type-narrowing when parsing lifecycle from request context.
 */
const ALL_LIFECYCLES: readonly NodeLifecycle[] = [
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

/** Regex for extracting lifecycle from assembled message content blocks. */
const LIFECYCLE_RE = /Lifecycle:\s*([a-z_]+)/;

/**
 * Type-narrow a raw string to a {@link NodeLifecycle}.
 */
function toLifecycle(raw: string): NodeLifecycle | null {
	const candidate = raw.trim().toLowerCase();
	return (ALL_LIFECYCLES as readonly string[]).includes(candidate)
		? (candidate as NodeLifecycle)
		: null;
}

/**
 * Detect the node lifecycle from an assembled {@link LlmRequest}.
 *
 * Lookup order:
 * 1. `request.metadata.lifecycle`
 * 2. `request.metadata.nodeLifecycle`
 * 3. `request.metadata.currentLifecycle`
 * 4. Regex scan of `request.messages[*].content` for `Lifecycle: <lifecycle>`
 * 5. Fallback to `'not_started'`
 */
function detectLifecycle(request: LlmRequest): NodeLifecycle {
	// ── Metadata keys ──────────────────────────────────────────────
	const meta = request.metadata ?? {};

	for (const key of ['lifecycle', 'nodeLifecycle', 'currentLifecycle'] as const) {
		const raw = meta[key];
		if (typeof raw === 'string') {
			const parsed = toLifecycle(raw);
			if (parsed) return parsed;
		}
	}

	// ── Message content scan ───────────────────────────────────────
	for (const msg of request.messages ?? []) {
		const match = LIFECYCLE_RE.exec(msg.content);
		if (match?.[1]) {
			const parsed = toLifecycle(match[1]);
			if (parsed) return parsed;
		}
	}

	// ── Fallback ───────────────────────────────────────────────────
	return 'not_started';
}

/** Shallow-clone an object to avoid test cross-contamination. */
function clone<T>(value: T): T {
	return JSON.parse(JSON.stringify(value)) as T;
}

// ═══════════════════════════════════════════════════════════════════════════
// Default fixtures
// ═══════════════════════════════════════════════════════════════════════════

/** Fixed timestamp for deterministic fixture generation. */
const MOCK_GENERATED_AT = '2024-01-01T00:00:00.000Z';

/**
 * Build a {@link CanonicalAnswerDraft} suitable for synthesis fixtures.
 */
function makeDraft(overrides: Partial<CanonicalAnswerDraft> = {}): CanonicalAnswerDraft {
	return {
		content: 'The answer synthesised from conversation history.',
		format: 'markdown',
		generatedAt: MOCK_GENERATED_AT,
		generatedFromMessageIds: [],
		confidence: 'medium',
		...overrides,
	};
}

/** Canonical answer draft used by `ready_for_synthesis` and `synthesized` fixtures. */
const DRAFT = makeDraft({ generatedAt: MOCK_GENERATED_AT });

/**
 * Default fixture map: one {@link AgentTurnOutput} per {@link NodeLifecycle}.
 *
 * Each fixture is a valid `AgentTurnOutput` that will pass
 * {@link validateAgentTurnOutput} schema validation.
 */
const DEFAULT_FIXTURES: Record<NodeLifecycle, AgentTurnOutput> = {
	not_started: {
		userFacingMessage:
			'What conviction makes this project necessary? ' +
			'What truth about the world drives the decision to build this?',
		proposedLifecycle: 'active',
		proposedPromptState: 'follow_up',
		suggestedActions: ['answer', 'defer', 'mark_as_assumption', 'mark_as_decision'],
	},

	active: {
		userFacingMessage:
			"That's a clear conviction. Is the tension primarily that " +
			'the current approach is slow, unfair, or produces bad outcomes?',
		proposedPromptState: 'follow_up',
		suggestedActions: ['answer', 'defer', 'mark_as_assumption', 'mark_as_decision'],
	},

	answered: {
		userFacingMessage:
			'Good. Can you elaborate on how this insight translates ' +
			'into a concrete differentiator for your project?',
		proposedPromptState: 'follow_up',
		suggestedActions: ['answer', 'defer', 'mark_as_assumption', 'mark_as_decision'],
	},

	needs_clarification: {
		userFacingMessage:
			'I see a potential ambiguity. You mentioned both "everyone" ' +
			'and "technical teams" — these point in different directions. ' +
			'Who is the primary user you are building for first?',
		proposedLifecycle: 'active',
		proposedPromptState: 'follow_up',
		suggestedActions: ['answer', 'defer', 'mark_as_assumption', 'mark_as_decision'],
	},

	needs_refinement: {
		userFacingMessage:
			'Your thesis is clear but could apply to any startup. ' +
			'What makes this conviction specific to your project? ' +
			'Is there a personal experience, dataset, or market shift ' +
			'that only you have observed?',
		proposedLifecycle: 'active',
		proposedPromptState: 'follow_up',
		suggestedActions: ['answer', 'defer', 'mark_as_assumption', 'mark_as_decision'],
	},

	ready_for_synthesis: {
		userFacingMessage:
			'Enough information has been gathered. I will now draft a ' +
			'canonical answer from the conversation.',
		proposedLifecycle: 'synthesized',
		proposedPromptState: 'review',
		canonicalAnswerDraft: DRAFT,
		suggestedActions: ['accept', 'edit', 'regenerate', 'defer', 'reopen'],
	},

	synthesized: {
		userFacingMessage:
			"Here's a draft of your canonical answer. Review it and " +
			'accept, edit, or regenerate.',
		proposedPromptState: 'review',
		canonicalAnswerDraft: DRAFT,
		suggestedActions: ['accept', 'edit', 'regenerate', 'defer', 'reopen'],
	},

	blocked: {
		userFacingMessage:
			'This node depends on a prerequisite that has not been ' +
			'accepted yet. Please complete the prerequisite node first.',
		proposedPromptState: 'blocked',
		suggestedActions: ['open_prerequisite', 'defer'],
	},

	accepted: {
		userFacingMessage:
			'Canonical answer accepted. The next recommended node is ' +
			'available when you are ready.',
		proposedPromptState: 'accepted',
		suggestedActions: ['continue_next', 'reopen', 'open_document_preview'],
	},

	deferred: {
		userFacingMessage:
			'This node has been deferred. You can resume it when ready, ' +
			'or continue with other nodes.',
		suggestedActions: ['resume', 'continue_next'],
	},
};

// ═══════════════════════════════════════════════════════════════════════════
// MockLlmProvider
// ═══════════════════════════════════════════════════════════════════════════

/**
 * An {@link LlmProvider} that returns predetermined `AgentTurnOutput`
 * fixtures based on the node lifecycle detected in the request context.
 *
 * Key behaviours:
 * - **No network calls** — all responses come from in-memory fixtures.
 * - **Lifecycle detection** — reads lifecycle from request metadata
 *   or parses the assembled message blocks.
 * - **Fixture cloning** — every `generateStructuredOutput` call returns
 *   a deep clone to prevent test cross-contamination.
 * - **Runtime overrides** — `setFixture` allows per-test fixture
 *   customization without reconstructing the provider.
 *
 * @example
 * ```ts
 * const mock = new MockLlmProvider();
 *
 * // Default: returns `not_started` fixture if no lifecycle metadata.
 * const response = await mock.generateStructuredOutput({
 *   systemPrompt: '...',
 *   messages: [],
 *   schema: {},
 * });
 * ```
 *
 * @example
 * ```ts
 * // Override a single lifecycle fixture for a specific test.
 * mock.setFixture('synthesized', {
 *   userFacingMessage: 'Custom review prompt.',
 *   proposedPromptState: 'review',
 * });
 * ```
 */
export class MockLlmProvider implements LlmProvider {
	/**
	 * Fixture map keyed by {@link NodeLifecycle}.
	 *
	 * Initialised from defaults, optionally overridden via constructor.
	 */
	public readonly fixtures: Record<NodeLifecycle, AgentTurnOutput>;

	/**
	 * @param customFixtures — partial fixture overrides applied at construction time.
	 */
	constructor(
		customFixtures: Partial<Record<NodeLifecycle, AgentTurnOutput>> = {},
	) {
		this.fixtures = { ...DEFAULT_FIXTURES, ...customFixtures };
	}

	// ── Public API ──────────────────────────────────────────────────────

	/**
	 * Return the fixture for the lifecycle detected in `request`.
	 *
	 * The lifecycle is resolved via {@link detectLifecycle}; the
	 * returned fixture is a deep clone to prevent mutation leakage
	 * across test cases.
	 */
	async generateStructuredOutput(
		request: LlmRequest,
	): Promise<LlmResponse> {
		const lifecycle = detectLifecycle(request);
		return clone(this.fixtures[lifecycle]);
	}

	/**
	 * Override the fixture for a specific lifecycle at runtime.
	 *
	 * Useful for injecting test-specific responses without
	 * reconstructing the provider.
	 */
	setFixture(
		lifecycle: NodeLifecycle,
		output: AgentTurnOutput,
	): void {
		this.fixtures[lifecycle] = output;
	}
}
