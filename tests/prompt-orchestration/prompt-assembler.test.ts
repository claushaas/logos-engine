/**
 * Tests for `assemblePromptRequest` — deterministic context injection,
 * priority ordering, token-budget enforcement, summary fallback, and
 * output schema attachment.
 */
import { describe, expect, it } from 'vitest';
import type {
	CanonicalAnswer,
	GlobalContext,
	NodeDefinition,
	NodeLifecycle,
	NodeMessage,
	NodeRuntimeState,
	PromptState,
} from '../../src/contracts/index.js';
import type { NodeAction } from '../../src/contracts/node-state.js';
import {
	AGENT_TURN_OUTPUT_SCHEMA_REFERENCE,
	assemblePromptRequest,
	assemblePromptRequestWithMetadata,
	estimateTokens,
	type LlmMessage,
	type PromptAssemblyInput,
} from '../../src/prompt-orchestration/prompt-assembler.js';
import type { PromptDefinition } from '../../src/prompt-orchestration/prompt-registry.js';
import type {
	DocumentId,
	NodeId,
	ProfileId,
	PromptId,
} from '../../src/shared/index.js';

// ─── Test helpers ───────────────────────────────────────────────────────────

/** Create a minimal `PromptDefinition` for the given state. */
function makePrompt(
	promptState: PromptState,
	content = 'You are a test assistant.',
): PromptDefinition {
	return {
		content,
		id: `test.${promptState}` as PromptId,
		promptState,
		scope: { level: 'global' },
		version: '1.0.0',
	};
}

/** Create a minimal `NodeDefinition`. */
function makeNodeDef(
	id: string,
	canonicalQuestion = 'What is your thesis?',
): NodeDefinition {
	return {
		canonicalQuestion,
		coverageTopics: ['problem', 'solution'],
		documentId: 'doc-1' as DocumentId,
		id: id as NodeId,
		order: 1,
		phaseId: 'phase-1',
		promptRefs: {},
		sufficiencyCriteria: ['specific', 'actionable'],
		title: 'Thesis',
	};
}

/** Create a `NodeMessage`. */
function makeUserMsg(
	id: string,
	content: string,
): NodeMessage {
	return {
		content,
		createdAt: new Date().toISOString(),
		id,
		role: 'user',
	};
}

function makeAssistantMsg(
	id: string,
	content: string,
): NodeMessage {
	return {
		content,
		createdAt: new Date().toISOString(),
		id,
		role: 'assistant',
	};
}

/** Create a minimal `NodeRuntimeState`. */
function makeNodeState(
	nodeId: string,
	lifecycle: NodeLifecycle,
	conversation: NodeMessage[] = [],
	promptState?: PromptState,
): NodeRuntimeState {
	return {
		allowedActions: [],
		canonicalAnswer: null,
		completeness: {
			blockingIssues: [],
			complete: false,
			coverage: {},
			missing: [],
			weak: [],
		},
		conversation,
		dependencies: { blockedBy: [], requiredNodeIds: [], unlocks: [] },
		extracted: {
			assumptions: [],
			decisions: [],
			facts: [],
			openQuestions: [],
			risks: [],
		},
		lastAssistantMessageId: undefined,
		lastUserMessageId: undefined,
		lifecycle,
		nodeId: nodeId as NodeId,
		promptState: promptState ?? 'follow_up',
		updatedAt: new Date().toISOString(),
	};
}

/** Create a minimal `GlobalContext`. */
function makeGlobalContext(): GlobalContext {
	return {
		preferences: {},
		projectName: 'Test Project',
		summary: 'A test project for prompt assembly.',
	};
}

/** Create a minimal `CanonicalAnswer`. */
function makeCanonicalAnswer(content: string): CanonicalAnswer {
	return {
		accepted: true,
		acceptedAt: new Date().toISOString(),
		confidence: 'high',
		content,
		format: 'markdown',
		generatedAt: new Date().toISOString(),
		generatedFromMessageIds: ['msg-1'],
		stale: false,
	};
}

/** Create the full `PromptAssemblyInput` with defaults for tests. */
function makeInput(overrides: Partial<PromptAssemblyInput> = {}): PromptAssemblyInput {
	const nodeDef = overrides.nodeDefinition ?? makeNodeDef('node-1');
	const nodeState = overrides.nodeRuntimeState ?? makeNodeState('node-1', 'active');
	return {
		acceptedDependencies: [],
		allowedActions: overrides.allowedActions ?? ['answer', 'defer'],
		conversationContext: [],
		globalContext: makeGlobalContext(),
		nodeDefinition: nodeDef,
		nodeRuntimeState: nodeState,
		selectedPrompt: makePrompt(
			nodeState.promptState,
			'You are a structured documentation assistant.',
		),
		...overrides,
	};
}

// ─── Schema presence assertion ─────────────────────────────────────────────

/** Assert that the schema reference appears in the system prompt. */
function assertSchemaPresent(systemPrompt: string): void {
	expect(systemPrompt).toContain('Output Schema');
}

// ─── Content assertion helpers ─────────────────────────────────────────────

/** Join all message contents into a single string for assertion convenience. */
function messageContents(messages: LlmMessage[]): string {
	return messages.map((m) => m.content).join('\n');
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('assemblePromptRequest', () => {
	// ── not_started node — canonical question ────────────────────────────

	it('assembles prompt for not_started node → includes canonical question', () => {
		const input = makeInput({
			nodeRuntimeState: makeNodeState('node-1', 'not_started', [], 'initial'),
		});

		const request = assemblePromptRequest(input);

		// System prompt includes the selected prompt content.
		expect(request.systemPrompt).toContain('structured documentation assistant');

		// Messages should include the node definition block.
		const contents = messageContents(request.messages);
		expect(contents).toContain('What is your thesis?');
		expect(contents).toContain('Node: Thesis');
		expect(contents).toContain('problem, solution');
	});

	// ── active node — recent messages ────────────────────────────────────

	it('assembles prompt for active node → includes recent messages', () => {
		const conversation: NodeMessage[] = [
			makeUserMsg('u1', 'I think our thesis is about climate resilience.'),
			makeAssistantMsg('a1', 'That is a good start. Can you elaborate?'),
			makeUserMsg('u2', 'We focus on urban infrastructure adaptation.'),
		];

		const input = makeInput({
			conversationContext: conversation,
			nodeRuntimeState: makeNodeState(
				'node-1',
				'active',
				conversation,
				'follow_up',
			),
		});

		const request = assemblePromptRequest(input);

		const contents = messageContents(request.messages);
		expect(contents).toContain('climate resilience');
		expect(contents).toContain('urban infrastructure adaptation');

		// Latest user message should be in its own block.
		expect(contents).toContain('Latest User Message');
		expect(contents).toContain('urban infrastructure adaptation');
	});

	// ── Long conversation — summary fallback ─────────────────────────────

	it('assembles prompt for long conversation → includes summary, not full history', () => {
		// Build a conversation much longer than the budget can hold.
		// Use sentence-structured content so the summarizer can extract facts.
		const conversation: NodeMessage[] = [];
		for (let i = 0; i < 100; i++) {
			conversation.push(
				makeUserMsg(
					`u${i}`,
					`User message ${i} with substantial content that takes up token budget. ` +
						'We decided on a microservices architecture for the platform. ' +
						'The team chose Kubernetes as the orchestration layer. ' +
						'We assume the cloud provider supports GPU instances. ' +
						'The API gateway will use Envoy proxy for traffic management. ' +
						'We expect peak load to reach 50k requests per minute.',
				),
			);
			conversation.push(
				makeAssistantMsg(
					`a${i}`,
					`Assistant message ${i} also with substantial content to consume tokens. ` +
						'That is an interesting choice. Can you elaborate on the deployment strategy? ' +
						'What monitoring solutions are you considering for this setup? ' +
						'Have you thought about disaster recovery and failover procedures?',
				),
			);
		}

		const input = makeInput({
			conversationContext: conversation,
			maxTokens: 4096,
		});

		const { request, metadata } = assemblePromptRequestWithMetadata(input);

		// Metadata should indicate truncation + summary.
		expect(metadata.truncated).toBe(true);
		expect(metadata.summaryInjected).toBe(true);
		expect(metadata.trimmedMessageCount).toBeGreaterThan(0);
		// Token budget should be respected.
		expect(metadata.promptTokens).toBeLessThanOrEqual(
			metadata.effectiveBudget,
		);
		// We included fewer messages than the total.
		expect(metadata.includedMessageCount).toBeLessThan(
			conversation.length,
		);

		// Token budget should be respected.
		expect(metadata.promptTokens).toBeLessThanOrEqual(
			metadata.effectiveBudget,
		);

		const contents = messageContents(request.messages);

		// Summary block should be present.
		expect(contents).toContain('Conversation Summary');

		// Full history should NOT be present (the oldest messages should be trimmed).
		// We can verify by checking that the number of messages in request
		// is far less than the total conversation.
		expect(request.messages.length).toBeLessThan(conversation.length + 10);

		// The system prompt should still be intact.
		expect(request.systemPrompt).toContain('structured documentation assistant');
	});

	// ── Small budget — extreme truncation ────────────────────────────────

	it('respects small token budget — includes only floor messages + summary', () => {
		// Use real sentence-structured content so the summarizer can
		// extract facts/decisions/assumptions. Single-blob messages
		// without sentence delimiters may produce empty summaries.
		const conversation: NodeMessage[] = [];
		for (let i = 0; i < 50; i++) {
			conversation.push(
				makeUserMsg(
					`u${i}`,
					`We decided to use TypeScript for the frontend. ` +
						`The backend will be built with Rust. ` +
						`We assume the database can handle 10k requests per second. ` +
						`The deployment target is AWS ECS with Fargate. ` +
						`We chose PostgreSQL as our primary database. ` +
						`The API will follow REST conventions with OpenAPI 3.1. ` +
						`Logging will use structured JSON output to stdout. ` +
						`Metrics will be exported to Prometheus.`,
				),
			);
		}

		const input = makeInput({
			conversationContext: conversation,
			// Budget small enough to force heavy truncation but large
			// enough to hold the system prompt + fixed blocks + summary.
			maxTokens: 3072,
		});

		const { request, metadata } = assemblePromptRequestWithMetadata(input);

		expect(metadata.truncated).toBe(true);
		expect(metadata.summaryInjected).toBe(true);

		// Token budget should be respected.
		expect(metadata.promptTokens).toBeLessThanOrEqual(
			metadata.effectiveBudget,
		);

		// With a tight budget, included messages should be heavily reduced.
		expect(metadata.includedMessageCount).toBeLessThanOrEqual(
			conversation.length / 2,
		);

		const contents = messageContents(request.messages);
		expect(contents).toContain('Conversation Summary');
	});

	// ── Accepted dependencies included ───────────────────────────────────

	it('includes accepted dependencies when relevant', () => {
		const acceptedDeps: CanonicalAnswer[] = [
			makeCanonicalAnswer('Dependency 1 answer content.'),
			makeCanonicalAnswer('Dependency 2 answer content.'),
		];

		const input = makeInput({
			acceptedDependencies: acceptedDeps,
		});

		const request = assemblePromptRequest(input);

		const contents = messageContents(request.messages);
		expect(contents).toContain('Accepted Prerequisite Answers');
		expect(contents).toContain('Dependency 1 answer content.');
		expect(contents).toContain('Dependency 2 answer content.');

		// Dependency 1 should appear before Dependency 2 (supplied order).
		const idx1 = contents.indexOf('Dependency 1');
		const idx2 = contents.indexOf('Dependency 2');
		expect(idx1).toBeLessThan(idx2);
	});

	// ── No accepted deps — block not present ────────────────────────────

	it('does not include dependency block when none are supplied', () => {
		const input = makeInput({ acceptedDependencies: [] });

		const request = assemblePromptRequest(input);

		const contents = messageContents(request.messages);
		expect(contents).not.toContain('Accepted Prerequisite Answers');
	});

	// ── Output schema reference present ─────────────────────────────────

	it('attaches output schema reference in system prompt', () => {
		const input = makeInput();

		const request = assemblePromptRequest(input);

		assertSchemaPresent(request.systemPrompt);
		expect(request.systemPrompt).toContain('AgentTurnOutput');
		expect(request.systemPrompt).toContain('userFacingMessage');
	});

	// ── Custom output schema ────────────────────────────────────────────

	it('uses custom output schema when provided', () => {
		const customSchema = { type: 'object', properties: { answer: { type: 'string' } } };
		const input = makeInput({ outputSchema: customSchema });

		const request = assemblePromptRequest(input);

		expect(request.systemPrompt).toContain('"answer"');
		expect(request.schema).toBe(customSchema);
	});

	// ── Allowed actions constrain ──────────────────────────────────────

	it('includes allowed actions in the system prompt', () => {
		const input = makeInput({
			allowedActions: ['answer', 'defer', 'skip'],
		});

		const request = assemblePromptRequest(input);

		expect(request.systemPrompt).toContain('Allowed Actions');
		expect(request.systemPrompt).toContain('- answer');
		expect(request.systemPrompt).toContain('- defer');
		expect(request.systemPrompt).toContain('- skip');
	});

	// ── Lifecycle and prompt state in context ───────────────────────────

	it('includes lifecycle and prompt state in context messages', () => {
		const input = makeInput({
			nodeRuntimeState: makeNodeState(
				'node-1',
				'needs_clarification',
				[],
				'clarification',
			),
		});

		const request = assemblePromptRequest(input);

		const contents = messageContents(request.messages);
		expect(contents).toContain('Current State');
		expect(contents).toContain('Lifecycle: needs_clarification');
		expect(contents).toContain('Prompt State: clarification');
	});

	// ── Global context injected ─────────────────────────────────────────

	it('includes global project context when available', () => {
		const input = makeInput();

		const request = assemblePromptRequest(input);

		const contents = messageContents(request.messages);
		expect(contents).toContain('Project Context');
		expect(contents).toContain('Test Project');
	});

	// ── Global context absent ──────────────────────────────────────────

	it('omits global context block when empty', () => {
		const input = makeInput({
			globalContext: { preferences: {}, projectName: null, summary: null },
		});

		const request = assemblePromptRequest(input);

		const contents = messageContents(request.messages);
		expect(contents).not.toContain('Project Context');
	});

	// ── Profile metadata injected ──────────────────────────────────────

	it('includes profile metadata when provided', () => {
		const input = makeInput({
			profileMetadata: {
				description: 'A profile for testing.',
				id: 'test-profile',
				title: 'Test Profile',
				version: '2.0.0',
			},
		});

		const request = assemblePromptRequest(input);

		const contents = messageContents(request.messages);
		expect(contents).toContain('Profile');
		expect(contents).toContain('Test Profile');
		expect(contents).toContain('test-profile');
		expect(contents).toContain('A profile for testing.');
		expect(contents).toContain('2.0.0');
	});

	// ── Profile metadata omitted when absent ───────────────────────────

	it('omits profile metadata block when not provided', () => {
		const input = makeInput({ profileMetadata: undefined });

		const request = assemblePromptRequest(input);

		const contents = messageContents(request.messages);
		expect(contents).not.toContain('## Profile');
	});

	// ── Safety rules present ────────────────────────────────────────────

	it('includes non-negotiable safety rules in system prompt', () => {
		const input = makeInput();

		const request = assemblePromptRequest(input);

		expect(request.systemPrompt).toContain('Safety & Integrity Rules');
		expect(request.systemPrompt).toContain('Do not fabricate user decisions');
		expect(request.systemPrompt).toContain('Do not mark content as accepted');
		expect(request.systemPrompt).toContain('Ask at most one primary question');
	});

	// ── Metadata reports correct numbers ────────────────────────────────

	it('returns correct assembly metadata', () => {
		const conversation: NodeMessage[] = [
			makeUserMsg('u1', 'Hello'),
			makeAssistantMsg('a1', 'Hi there'),
		];

		const input = makeInput({
			conversationContext: conversation,
			maxTokens: 4096,
		});

		const { metadata } = assemblePromptRequestWithMetadata(input);

		expect(metadata.effectiveBudget).toBe(4096 - 1024); // default reserve
		expect(metadata.truncated).toBe(false);
		expect(metadata.summaryInjected).toBe(false);
		expect(metadata.includedMessageCount).toBe(2);
		expect(metadata.trimmedMessageCount).toBe(0);
		expect(metadata.promptTokens).toBeGreaterThan(0);
	});

	// ── Model and temperature passthrough ───────────────────────────────

	it('passes through model and temperature when provided', () => {
		const input = makeInput({
			model: 'claude-sonnet-4',
			temperature: 0.7,
		});

		const request = assemblePromptRequest(input);

		expect(request.model).toBe('claude-sonnet-4');
		expect(request.temperature).toBe(0.7);
	});

	// ── No conversation → no summary injected ───────────────────────────

	it('does not inject summary when conversation is empty', () => {
		const input = makeInput({ conversationContext: [] });

		const { metadata } = assemblePromptRequestWithMetadata(input);

		expect(metadata.summaryInjected).toBe(false);
	});

	// ── Token estimation ───────────────────────────────────────────────

	describe('estimateTokens', () => {
		it('returns 0 for empty string', () => {
			expect(estimateTokens('')).toBe(0);
		});

		it('returns ceil(len/4) for typical text', () => {
			expect(estimateTokens('hello')).toBe(2); // 5/4 = 1.25 → 2
			expect(estimateTokens('12345678')).toBe(2); // 8/4 = 2 → 2
			expect(estimateTokens('123456789')).toBe(3); // 9/4 = 2.25 → 3
		});
	});
});
