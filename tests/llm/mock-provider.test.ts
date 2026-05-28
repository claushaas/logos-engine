/**
 * Tests for MockLlmProvider — fixture-based LLM provider.
 *
 * Covers:
 * 1. returns initial question for `not_started`.
 * 2. returns review prompt for `synthesized`.
 * 3. constructor custom fixture overrides default.
 * 4. setFixture runtime override.
 * 5. lifecycle detection from message text (`Lifecycle: synthesized`).
 * 6. every lifecycle fixture passes `validateAgentTurnOutput` schema validation.
 * 7. fixture responses are deeply cloned (no cross-contamination).
 */
import { describe, expect, it } from 'vitest';
import type {
	AgentTurnOutput,
	NodeLifecycle,
} from '../../src/contracts/index.js';
import { MockLlmProvider } from '../../src/llm/mock-provider.js';
import type { LlmRequest } from '../../src/prompt-orchestration/prompt-assembler.js';
import { isOk } from '../../src/shared/index.js';
import { validateAgentTurnOutput } from '../../src/validation/agent-turn-validator.js';

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

/**
 * All valid {@link NodeLifecycle} values.
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

/**
 * Build a minimal {@link LlmRequest} with optional lifecycle metadata.
 */
function makeRequest(overrides: Partial<LlmRequest> = {}): LlmRequest {
	return {
		messages: [
			{ content: 'Node: Core Thesis', role: 'user' },
			{ content: 'What is the central thesis?', role: 'user' },
		],
		schema: { name: 'AgentTurnOutput' },
		systemPrompt: 'You are an expert interviewer.',
		...overrides,
	};
}

/**
 * Build a request with lifecycle embedded in the message content
 * (mimicking the prompt assembler's `buildLifecycleBlock`).
 */
function makeRequestWithLifecycleBlock(lifecycle: NodeLifecycle): LlmRequest {
	return makeRequest({
		messages: [
			{ content: '## Node Definition\nNode: Core Thesis', role: 'user' },
			{
				content: `## Current State\nLifecycle: ${lifecycle}\nPrompt State: initial`,
				role: 'user',
			},
		],
	});
}

// ═══════════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════════

describe('MockLlmProvider', () => {
	// ── 1. not_started returns initial question ───────────────────────
	it('returns initial question for not_started lifecycle', async () => {
		const provider = new MockLlmProvider();
		const response = await provider.generateStructuredOutput(
			makeRequest({ metadata: { lifecycle: 'not_started' } }),
		);

		expect(response.userFacingMessage).toBeTruthy();
		expect(response.proposedLifecycle).toBe('active');
		expect(response.proposedPromptState).toBe('follow_up');
		expect(response.suggestedActions).toContain('answer');
		expect(response.suggestedActions).toContain('defer');

		// Must pass validator.
		const result = validateAgentTurnOutput(response);
		expect(isOk(result)).toBe(true);
	});

	// ── 2. synthesized returns review prompt ─────────────────────────
	it('returns review prompt for synthesized lifecycle', async () => {
		const provider = new MockLlmProvider();
		const response = await provider.generateStructuredOutput(
			makeRequest({ metadata: { lifecycle: 'synthesized' } }),
		);

		expect(response.userFacingMessage).toBeTruthy();
		expect(response.proposedPromptState).toBe('review');
		expect(response.suggestedActions).toContain('accept');
		expect(response.suggestedActions).toContain('edit');
		expect(response.suggestedActions).toContain('regenerate');

		// Must pass validator.
		const result = validateAgentTurnOutput(response);
		expect(isOk(result)).toBe(true);
	});

	// ── 3. constructor custom fixture overrides default ──────────────
	it('supports custom fixtures via constructor', async () => {
		const customNotStarted: AgentTurnOutput = {
			proposedLifecycle: 'active',
			suggestedActions: ['answer'],
			userFacingMessage: 'Custom initial question.',
		};

		const provider = new MockLlmProvider({ not_started: customNotStarted });
		const response = await provider.generateStructuredOutput(
			makeRequest({ metadata: { lifecycle: 'not_started' } }),
		);

		expect(response.userFacingMessage).toBe('Custom initial question.');
		expect(response.suggestedActions).toEqual(['answer']);

		const result = validateAgentTurnOutput(response);
		expect(isOk(result)).toBe(true);
	});

	// ── 4. setFixture runtime override ───────────────────────────────
	it('supports setFixture for runtime overrides', async () => {
		const provider = new MockLlmProvider();

		// Override the active fixture at runtime.
		provider.setFixture('active', {
			proposedPromptState: 'follow_up',
			suggestedActions: ['defer'],
			userFacingMessage: 'Runtime override for active.',
		});

		const response = await provider.generateStructuredOutput(
			makeRequest({ metadata: { lifecycle: 'active' } }),
		);

		expect(response.userFacingMessage).toBe('Runtime override for active.');
		expect(response.suggestedActions).toEqual(['defer']);

		const result = validateAgentTurnOutput(response);
		expect(isOk(result)).toBe(true);
	});

	// ── 5. lifecycle detection from message text ─────────────────────
	it('detects lifecycle from message content block', async () => {
		const provider = new MockLlmProvider();
		const response = await provider.generateStructuredOutput(
			makeRequestWithLifecycleBlock('synthesized'),
		);

		expect(response.proposedPromptState).toBe('review');
		expect(response.suggestedActions).toContain('accept');

		const result = validateAgentTurnOutput(response);
		expect(isOk(result)).toBe(true);
	});

	// ── 6. every lifecycle fixture passes schema validation ──────────
	it.each(
		ALL_LIFECYCLES,
	)('default fixture for %s passes validateAgentTurnOutput', async (lifecycle) => {
		const provider = new MockLlmProvider();
		const response = await provider.generateStructuredOutput(
			makeRequest({ metadata: { lifecycle } }),
		);

		const result = validateAgentTurnOutput(response);
		expect(
			isOk(result),
			`Fixture for ${lifecycle} failed validation: ${
				!isOk(result) ? JSON.stringify(result.error) : ''
			}`,
		).toBe(true);
	});

	// ── 7. fixtures are cloned (no cross-contamination) ───────────────
	it('returns cloned fixtures to prevent mutation leakage', async () => {
		const provider = new MockLlmProvider();

		const res1 = await provider.generateStructuredOutput(
			makeRequest({ metadata: { lifecycle: 'not_started' } }),
		);
		const res2 = await provider.generateStructuredOutput(
			makeRequest({ metadata: { lifecycle: 'not_started' } }),
		);

		// Mutate the first response.
		(res1 as Record<string, unknown>).userFacingMessage = 'MUTATED';

		// Second response must be unaffected.
		expect(res2.userFacingMessage).not.toBe('MUTATED');
		expect(res2.userFacingMessage).toBeTruthy();
	});

	// ── 8. fallback to not_started when no lifecycle detectable ──────
	it('falls back to not_started when lifecycle metadata is absent', async () => {
		const provider = new MockLlmProvider();
		const response = await provider.generateStructuredOutput(
			makeRequest({
				messages: [{ content: 'no lifecycle here', role: 'user' }],
			}),
		);

		expect(response.proposedLifecycle).toBe('active');

		const result = validateAgentTurnOutput(response);
		expect(isOk(result)).toBe(true);
	});

	// ── 9. metadata.nodeLifecycle key works ──────────────────────────
	it('reads lifecycle from metadata.nodeLifecycle', async () => {
		const provider = new MockLlmProvider();
		const response = await provider.generateStructuredOutput(
			makeRequest({ metadata: { nodeLifecycle: 'blocked' } }),
		);

		expect(response.proposedPromptState).toBe('blocked');
		expect(response.suggestedActions).toContain('open_prerequisite');

		const result = validateAgentTurnOutput(response);
		expect(isOk(result)).toBe(true);
	});

	// ── 10. metadata.currentLifecycle key works ───────────────────────
	it('reads lifecycle from metadata.currentLifecycle', async () => {
		const provider = new MockLlmProvider();
		const response = await provider.generateStructuredOutput(
			makeRequest({ metadata: { currentLifecycle: 'accepted' } }),
		);

		expect(response.proposedPromptState).toBe('accepted');
		expect(response.suggestedActions).toContain('continue_next');

		const result = validateAgentTurnOutput(response);
		expect(isOk(result)).toBe(true);
	});

	// ── 11. metadata.lifecycle takes priority over other keys ────────
	it('metadata.lifecycle takes priority over nodeLifecycle', async () => {
		const provider = new MockLlmProvider();
		const response = await provider.generateStructuredOutput(
			makeRequest({
				metadata: {
					lifecycle: 'synthesized',
					nodeLifecycle: 'not_started',
				},
			}),
		);

		// Should use 'synthesized' (priority key), not 'not_started'.
		expect(response.proposedPromptState).toBe('review');
		expect(response.suggestedActions).toContain('accept');

		const result = validateAgentTurnOutput(response);
		expect(isOk(result)).toBe(true);
	});
});
