/**
 * Prompt assembler — deterministic context injection and token-budget
 * enforcement for the final LLM request.
 *
 * Consumes the selected prompt from {@link ./prompt-selector.js}, the
 * node's runtime state, conversation history, accepted dependency answers,
 * and global context, and produces a budget-aware `LlmRequest` ready for
 * the provider adapter.
 *
 * All functions are pure: no state mutation, no side effects, no LLM calls.
 *
 * @see {@link https://logos-engine/docs/05-prompt-orchestration-spec.md §7–8}
 * @see {@link https://logos-engine/docs/architecture/05-llm-integration-architecture.md §9}
 */
import type {
	CanonicalAnswer,
	GlobalContext,
	NodeAction,
	NodeDefinition,
	NodeLifecycle,
	NodeMessage,
	NodeRuntimeState,
	PromptState,
} from '../contracts/index.js';
import { summarizeConversation } from '../conversation-runtime/summarizer.js';
import type { PromptDefinition } from './prompt-registry.js';

// ═══════════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Default maximum token budget for the assembled prompt.
 *
 * The provider adapter may override this per-request, but assembly
 * always respects whatever cap is given.
 */
const DEFAULT_MAX_TOKENS = 4096;

/**
 * Token reserve kept free for the LLM response.
 *
 * The actual prompt budget is `maxTokens - DEFAULT_RESPONSE_TOKEN_RESERVE`
 * so the response has guaranteed headroom.
 */
const DEFAULT_RESPONSE_TOKEN_RESERVE = 1024;

/**
 * Default number of most-recent messages retained when the full
 * conversation fits within the budget.
 */
const DEFAULT_RECENT_MESSAGE_LIMIT = 20;

/**
 * When the conversation is truncated to fit budget, the summarizer
 * runs on the *older* portion. This many most-recent messages are
 * always included in full (provided they fit).
 */
const RECENT_MESSAGE_FLOOR = 3;

// ═══════════════════════════════════════════════════════════════════════════
// Exported reference for AgentTurnOutput schema
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Lightweight reference to the `AgentTurnOutput` schema.
 *
 * This is NOT a validation schema — it is a human- and LLM-readable
 * description of the expected structured output shape. The actual
 * validation schema is defined in Step 6.1.
 */
export const AGENT_TURN_OUTPUT_SCHEMA_REFERENCE = {
	description:
		'Structured output containing userFacingMessage (required), ' +
		'proposedLifecycle, proposedPromptState, canonicalAnswerDraft, ' +
		'completenessEvaluation, extracted, suggestedActions, transitionIntent, diagnostics.',
	name: 'AgentTurnOutput',
	ref: 'AgentTurnOutput',
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// Public types
// ═══════════════════════════════════════════════════════════════════════════

/**
 * A single message in the assembled LLM request.
 *
 * Mirrors the provider-agnostic message shape expected by
 * the LLM provider adapter (Step 7.1).
 */
export type LlmMessage = {
	/** Sender role (no `system` here — system prompt is separate). */
	readonly role: 'user' | 'assistant';

	/** Message body (plain text or Markdown). */
	readonly content: string;
};

/**
 * The fully assembled LLM request — ready for the provider adapter.
 *
 * @see {@link https://logos-engine/docs/architecture/05-llm-integration-architecture.md §3}
 */
export type LlmRequest = {
	/** The assembled system prompt (instructions + rules + schema). */
	readonly systemPrompt: string;

	/** Ordered context messages (node definition, conversation, deps, etc.). */
	readonly messages: LlmMessage[];

	/** Reference to the expected output schema. */
	readonly schema: unknown;

	/** Optionally requested model (passthrough to provider). */
	readonly model?: string;

	/** Optionally requested temperature (passthrough to provider). */
	readonly temperature?: number;

	/** Arbitrary metadata for tracing (passthrough to provider). */
	readonly metadata?: Record<string, unknown>;
};

/**
 * Sparse profile metadata injected into the prompt when available.
 *
 * Derived from `LogosProfile` fields relevant to prompt assembly.
 */
export type ProfileMetadata = {
	/** Profile ID. */
	readonly id: string;

	/** Human-readable profile title. */
	readonly title: string;

	/** Optional description of the profile's purpose. */
	readonly description?: string;

	/** Schema version string. */
	readonly version?: string;
};

/**
 * Input for the prompt assembler.
 *
 * Every field except `maxTokens`, `recentMessageLimit`, `outputSchema`,
 * `profileMetadata`, and `model`/`temperature` is required.
 */
export type PromptAssemblyInput = {
	/**
	 * The prompt definition selected by {@link ./prompt-selector.js}.
	 *
	 * Must be non-null — callers should check `selectPrompt()` before
	 * assembling (it returns `null` for deferred nodes, etc.).
	 */
	readonly selectedPrompt: PromptDefinition;

	/** Static node definition (canonical question, coverage topics, etc.). */
	readonly nodeDefinition: NodeDefinition;

	/** Current runtime state of the node. */
	readonly nodeRuntimeState: NodeRuntimeState;

	/**
	 * Full conversation history for the node.
	 *
	 * Ordered oldest-first.
	 */
	readonly conversationContext: NodeMessage[];

	/** Session-scoped global context. */
	readonly globalContext: GlobalContext;

	/**
	 * Accepted canonical answers from prerequisite nodes, ordered by
	 * dependency priority (closest dependency first).
	 *
	 * The assembler injects them in the supplied order without re-sorting.
	 */
	readonly acceptedDependencies: CanonicalAnswer[];

	/**
	 * Actions allowed for the current lifecycle.
	 *
	 * Computed by the state engine via `getAllowedActions`.
	 */
	readonly allowedActions: NodeAction[];

	/**
	 * Output schema reference.
	 *
	 * Defaults to `AGENT_TURN_OUTPUT_SCHEMA_REFERENCE` when omitted.
	 */
	readonly outputSchema?: unknown;

	/**
	 * Sparse profile metadata injected at the end of the prompt context.
	 *
	 * Derived from `LogosProfile` — passed separately so the assembler
	 * does not need a full `LogosProfile` dependency.
	 */
	readonly profileMetadata?: ProfileMetadata;

	/**
	 * Maximum token budget for the assembled prompt (inclusive of
	 * the response reserve).
	 *
	 * Defaults to `DEFAULT_MAX_TOKENS` (4096).
	 */
	readonly maxTokens?: number;

	/**
	 * Maximum number of most-recent messages to include from the
	 * conversation when the full history fits within the budget.
	 *
	 * Defaults to `DEFAULT_RECENT_MESSAGE_LIMIT` (20).
	 */
	readonly recentMessageLimit?: number;

	/**
	 * Optional model override (passthrough to `LlmRequest.model`).
	 */
	readonly model?: string;

	/**
	 * Optional temperature override (passthrough to `LlmRequest.temperature`).
	 */
	readonly temperature?: number;
};

/**
 * Result metadata returned alongside the assembled request for tracing.
 */
export type AssemblyMetadata = {
	/** Estimated token count of the assembled prompt. */
	readonly promptTokens: number;

	/** Whether the conversation was truncated due to budget constraints. */
	readonly truncated: boolean;

	/** Whether the conversation summary was injected (long conversation). */
	readonly summaryInjected: boolean;

	/** Number of full messages included. */
	readonly includedMessageCount: number;

	/** Number of messages trimmed from the conversation. */
	readonly trimmedMessageCount: number;

	/** Effective token budget (maxTokens minus reserve). */
	readonly effectiveBudget: number;
};

// ═══════════════════════════════════════════════════════════════════════════
// Token estimation
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Estimate the number of tokens for a given text.
 *
 * Uses a simple deterministic heuristic: `ceil(text.length / 4)`.
 * This is a rough approximation — typical English text averages ~4
 * characters per token. Not intended as a precise tokeniser.
 */
export function estimateTokens(text: string): number {
	return Math.ceil(text.length / 4);
}

// ═══════════════════════════════════════════════════════════════════════════
// Fixed-framework text blocks
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Non-negotiable safety and integrity rules appended to every system prompt.
 *
 * Aligned with {@link https://logos-engine/docs/05-prompt-orchestration-spec.md §10}.
 */
const SAFETY_RULES = [
	'Do not fabricate user decisions.',
	'Do not mark content as accepted.',
	'Do not silently fill unknowns.',
	'Separate facts, assumptions, decisions, risks, and open questions.',
	'Ask at most one primary question per turn.',
	'Generate synthesis only when the prompt state allows it.',
	'Preserve unresolved tensions instead of smoothing them away.',
	'Keep the interaction conversational, not form-like.',
];

/** Format the allowed actions list as a constraints block. */
function formatAllowedActions(allowed: NodeAction[]): string {
	if (allowed.length === 0) return '';
	const list = allowed.map((a) => `- ${a}`).join('\n');
	return `\n## Allowed Actions\nThe user may take these actions:\n${list}`;
}

/** Format the output schema as an instruction block. */
function formatOutputSchema(schema: unknown): string {
	let schemaStr: string;
	if (typeof schema === 'string') {
		schemaStr = schema;
	} else if (schema !== null && typeof schema === 'object') {
		schemaStr = JSON.stringify(schema, null, 2);
	} else {
		schemaStr = String(schema);
	}
	return `\n## Output Schema\nYou must return a structured JSON object conforming to:\n\`\`\`json\n${schemaStr}\n\`\`\``;
}

// ═══════════════════════════════════════════════════════════════════════════
// Context block builders
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Build a context block describing the active node definition.
 *
 * Priority 2 in the spec — only the system instruction is higher.
 */
function buildNodeDefinitionBlock(def: NodeDefinition): string {
	const lines: string[] = [];

	lines.push(`## Node: ${def.title}`);
	lines.push(`Canonical Question: ${def.canonicalQuestion}`);

	if (def.coverageTopics.length > 0) {
		lines.push(`Coverage Topics: ${def.coverageTopics.join(', ')}`);
	}
	if (def.sufficiencyCriteria.length > 0) {
		lines.push(`Sufficiency Criteria: ${def.sufficiencyCriteria.join('; ')}`);
	}

	return lines.join('\n');
}

/**
 * Build a context block describing the current lifecycle and prompt state.
 *
 * Priority 3.
 */
function buildLifecycleBlock(
	lifecycle: NodeLifecycle,
	promptState: PromptState,
): string {
	return `## Current State\nLifecycle: ${lifecycle}\nPrompt State: ${promptState}`;
}

/**
 * Build a context block for the latest user message.
 *
 * Priority 4. Returns `null` if no user message exists.
 */
function buildLatestUserMessageBlock(messages: NodeMessage[]): string | null {
	// Walk backwards to find the latest user message.
	for (let i = messages.length - 1; i >= 0; i--) {
		const msg = messages[i];
		if (msg !== undefined && msg.role === 'user') {
			return `## Latest User Message\n${msg.content}`;
		}
	}
	return null;
}

/**
 * Build a context block from recent conversation messages.
 *
 * Priority 5. `messages` is already ordered oldest-first.
 */
function buildRecentConversationBlock(messages: NodeMessage[]): string {
	if (messages.length === 0) return '';

	const lines: string[] = ['## Recent Conversation'];
	for (const msg of messages) {
		const label = msg.role === 'user' ? 'User' : 'Assistant';
		lines.push(`### ${label}\n${msg.content}`);
	}
	return lines.join('\n\n');
}

/**
 * Build a context block for the conversation summary.
 *
 * Priority 6 — used as fallback when the full history is truncated.
 *
 * Returns `null` when the summary would be empty.
 */
function buildSummaryBlock(messages: NodeMessage[]): string | null {
	const summary = summarizeConversation(messages);
	if (!summary) return null;
	return `## Conversation Summary\n${summary}`;
}

/**
 * Build a context block for accepted prerequisite node answers.
 *
 * Priority 7. Injected in supplied order.
 */
function buildAcceptedDependenciesBlock(
	deps: CanonicalAnswer[],
): string | null {
	if (deps.length === 0) return null;

	const lines: string[] = ['## Accepted Prerequisite Answers'];
	for (const [i, dep] of deps.entries()) {
		const prefix = `### Dependency ${i + 1}`;
		const status = dep.accepted ? ' (accepted)' : ' (stale)';
		const confidence = ` (confidence: ${dep.confidence})`;
		lines.push(`${prefix}${status}${confidence}`);
		lines.push(dep.content);
	}
	return lines.join('\n\n');
}

/**
 * Build a context block for global project context.
 *
 * Priority 8.
 */
function buildGlobalContextBlock(ctx: GlobalContext): string | null {
	const parts: string[] = [];
	if (ctx.projectName) {
		parts.push(`Project: ${ctx.projectName}`);
	}
	if (ctx.summary) {
		parts.push(`Summary: ${ctx.summary}`);
	}
	if (parts.length === 0) return null;
	return `## Project Context\n${parts.join('\n')}`;
}

/**
 * Build a context block for profile metadata.
 *
 * Priority 9.
 */
function buildProfileMetadataBlock(
	metadata: ProfileMetadata | undefined,
): string | null {
	if (!metadata) return null;
	const parts: string[] = [`Profile: ${metadata.title} (${metadata.id})`];
	if (metadata.description) {
		parts.push(`Description: ${metadata.description}`);
	}
	if (metadata.version) {
		parts.push(`Version: ${metadata.version}`);
	}
	return `## Profile\n${parts.join('\n')}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// System prompt assembly
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Assemble the system prompt from the selected prompt content,
 * safety rules, allowed actions, and output schema instruction.
 *
 * The system prompt is always included in full — it is never truncated
 * for budget reasons. If the system prompt alone exceeds the budget, the
 * function still returns it (the caller can detect this via metadata).
 */
function assembleSystemPrompt(
	selectedPrompt: PromptDefinition,
	allowedActions: NodeAction[],
	outputSchema: unknown,
): string {
	const sections: string[] = [];

	// 1. Core system instruction from the selected prompt.
	sections.push(selectedPrompt.content);

	// 2. Non-negotiable safety rules.
	sections.push(
		`## Safety & Integrity Rules\n${SAFETY_RULES.map((r) => `- ${r}`).join('\n')}`,
	);

	// 3. Allowed action constraints.
	const actionsBlock = formatAllowedActions(allowedActions);
	if (actionsBlock) {
		sections.push(actionsBlock);
	}

	// 4. Output schema instruction.
	sections.push(formatOutputSchema(outputSchema));

	return sections.join('\n\n');
}

// ═══════════════════════════════════════════════════════════════════════════
// Context message assembly
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Assemble the ordered `LlmMessage[]` from context blocks.
 *
 * Blocks are built in priority order:
 * 1. Node definition
 * 2. Lifecycle and prompt state
 * 3. Latest user message
 * 4. Recent conversation / summary fallback
 * 5. Accepted dependencies
 * 6. Global project context
 * 7. Profile metadata
 *
 * Blocks that produce `null` are silently skipped.
 */
function assembleContextMessages(
	input: PromptAssemblyInput,
	conversationMessages: NodeMessage[],
	summaryInjected: boolean,
): LlmMessage[] {
	const blocks: { label: string; content: string }[] = [];

	const nodeDefBlock = buildNodeDefinitionBlock(input.nodeDefinition);
	blocks.push({ content: nodeDefBlock, label: 'node-definition' });

	const lifecycleBlock = buildLifecycleBlock(
		input.nodeRuntimeState.lifecycle,
		input.nodeRuntimeState.promptState,
	);
	blocks.push({ content: lifecycleBlock, label: 'lifecycle' });

	const latestUser = buildLatestUserMessageBlock(input.conversationContext);
	if (latestUser) {
		blocks.push({ content: latestUser, label: 'latest-user' });
	}

	if (conversationMessages.length > 0) {
		const convBlock = buildRecentConversationBlock(conversationMessages);
		blocks.push({ content: convBlock, label: 'conversation' });
	}

	if (summaryInjected) {
		const summary = buildSummaryBlock(input.conversationContext);
		if (summary) {
			blocks.push({ content: summary, label: 'summary' });
		}
	}

	const depsBlock = buildAcceptedDependenciesBlock(input.acceptedDependencies);
	if (depsBlock) {
		blocks.push({ content: depsBlock, label: 'dependencies' });
	}

	const globalBlock = buildGlobalContextBlock(input.globalContext);
	if (globalBlock) {
		blocks.push({ content: globalBlock, label: 'global-context' });
	}

	const profileBlock = buildProfileMetadataBlock(input.profileMetadata);
	if (profileBlock) {
		blocks.push({ content: profileBlock, label: 'profile' });
	}

	return blocks.map((b) => ({ content: b.content, role: 'user' as const }));
}

// ═══════════════════════════════════════════════════════════════════════════
// Budget enforcement
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Enforce the token budget on the full conversation context.
 *
 * Returns:
 * - `messages`: the conversation `NodeMessage[]` to include.
 * - `trimmedCount`: how many older messages were trimmed.
 * - `summaryInjected`: whether the summarizer was called.
 *
 * Strategy:
 * 1. Fixed blocks + summary tokens always consume first.
 * 2. If remaining budget allows the full conversation (up to
 *    `recentMessageLimit`), include all of them.
 * 3. Otherwise, keep the `RECENT_MESSAGE_FLOOR` newest messages
 *    and fall back to the summary for the older portion.
 */
function applyTokenBudget(
	conversation: NodeMessage[],
	recentMessageLimit: number,
	conversationBudget: number,
): {
	messages: NodeMessage[];
	trimmedCount: number;
	summaryInjected: boolean;
} {
	const remaining = conversationBudget;
	if (remaining <= 0) {
		// Barely any room — include no conversation, fall back to summary.
		return {
			messages: [],
			summaryInjected: true,
			trimmedCount: conversation.length,
		};
	}

	// 1. Try to include the conversation up to recentMessageLimit.
	const recent = conversation.slice(-recentMessageLimit);
	const recentTokens = recent.reduce(
		(sum, m) => sum + estimateTokens(m.content),
		0,
	);

	if (recentTokens <= remaining) {
		// Fits! No truncation needed.
		const trimmedCount = Math.max(0, conversation.length - recent.length);
		return {
			messages: recent,
			summaryInjected: trimmedCount > 0,
			trimmedCount,
		};
	}

	// 2. Budget is tight — keep at least RECENT_MESSAGE_FLOOR messages
	//    and fall back to summary for older context.
	const floor = Math.min(RECENT_MESSAGE_FLOOR, conversation.length);
	const floorMessages = conversation.slice(-floor);
	const floorTokens = floorMessages.reduce(
		(sum, m) => sum + estimateTokens(m.content),
		0,
	);

	if (floorTokens > remaining) {
		// Even the floor doesn't fit — include nothing, rely on summary.
		return {
			messages: [],
			summaryInjected: true,
			trimmedCount: conversation.length,
		};
	}

	// Try to extend from floor up to budget.
	let included = floorMessages;
	let usedTokens = floorTokens;
	for (let i = conversation.length - floor - 1; i >= 0; i--) {
		const msg = conversation[i];
		if (!msg) continue;
		const msgTokens = estimateTokens(msg.content);
		if (usedTokens + msgTokens > remaining) break;
		included = [msg, ...included];
		usedTokens += msgTokens;
	}

	const trimmedCount = conversation.length - included.length;
	return { messages: included, summaryInjected: true, trimmedCount };
}

// ═══════════════════════════════════════════════════════════════════════════
// Core assembly
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Assemble the final LLM request with metadata about token usage and
 * truncation decisions.
 *
 * This is the internal workhorse — `assemblePromptRequest` wraps it
 * and returns only the `LlmRequest`.
 *
 * Context is assembled in priority order (per spec §8):
 * 1. System instruction (from selected prompt).
 * 2. Node definition (canonical question, coverage topics, sufficiency criteria).
 * 3. Current lifecycle and prompt state.
 * 4. Latest user message.
 * 5. Recent node conversation (last N messages, respecting budget).
 * 6. Node conversation summary (if conversation was truncated).
 * 7. Accepted prerequisite node answers (in supplied order).
 * 8. Global project context.
 * 9. Profile metadata.
 *
 * The output schema reference and allowed actions are attached as
 * additional system prompt blocks. Token budget is enforced via
 * truncation of older conversation messages with summary fallback.
 */
function assembleInternal(input: PromptAssemblyInput): {
	request: LlmRequest;
	metadata: AssemblyMetadata;
} {
	const maxTokens = input.maxTokens ?? DEFAULT_MAX_TOKENS;
	const recentMessageLimit =
		input.recentMessageLimit ?? DEFAULT_RECENT_MESSAGE_LIMIT;
	const effectiveBudget = maxTokens - DEFAULT_RESPONSE_TOKEN_RESERVE;
	const outputSchema = input.outputSchema ?? AGENT_TURN_OUTPUT_SCHEMA_REFERENCE;

	// 1. Assemble the system prompt.
	const systemPrompt = assembleSystemPrompt(
		input.selectedPrompt,
		input.allowedActions,
		outputSchema,
	);

	const systemTokens = estimateTokens(systemPrompt);

	// 2. Pre-compute the summary block and its token cost so it is
	//    accounted for *before* deciding how many conversation messages fit.
	const summaryBlock = buildSummaryBlock(input.conversationContext);
	const summaryTokens = summaryBlock ? estimateTokens(summaryBlock) : 0;

	// 3. Build the *fixed* context blocks (everything except conversation
	//    and summary). We build them once to measure their token cost.
	const placeholderConv: NodeMessage[] = [];
	const placeholderSummary = false;
	const fixedBlocks = assembleContextMessages(
		input,
		placeholderConv,
		placeholderSummary,
	);

	const fixedTokens = fixedBlocks.reduce(
		(sum, m) => sum + estimateTokens(m.content),
		0,
	);

	// 4. Conversation budget = effectiveBudget minus everything else.
	const conversationBudget =
		effectiveBudget - systemTokens - fixedTokens - summaryTokens;

	// 5. Enforce token budget on conversation.
	const budgetResult = applyTokenBudget(
		input.conversationContext,
		recentMessageLimit,
		conversationBudget,
	);

	// 6. Rebuild context messages with the budgeted conversation,
	//    and inject the summary only if needed.
	const messages = assembleContextMessages(
		input,
		budgetResult.messages,
		budgetResult.summaryInjected && summaryBlock !== null,
	);

	// 7. Compute token metadata.
	const promptTokens =
		systemTokens +
		messages.reduce((sum, m) => sum + estimateTokens(m.content), 0);

	const metadata: AssemblyMetadata = {
		effectiveBudget,
		includedMessageCount: budgetResult.messages.length,
		promptTokens,
		summaryInjected: budgetResult.summaryInjected && summaryBlock !== null,
		trimmedMessageCount: budgetResult.trimmedCount,
		truncated: budgetResult.trimmedCount > 0,
	};

	return {
		metadata,
		request: {
			messages,
			schema: outputSchema,
			systemPrompt,
			...(input.model !== undefined ? { model: input.model } : {}),
			...(input.temperature !== undefined
				? { temperature: input.temperature }
				: {}),
		},
	};
}

/**
 * Assemble the final LLM request from the selected prompt, node state,
 * conversation context, accepted dependencies, and global context.
 *
 * This is the primary public API (matching the roadmap signature).
 * For token usage diagnostics, use {@link assemblePromptRequestWithMetadata}.
 *
 * @param input  - All inputs required for assembly.
 * @returns A fully assembled, budget-conforming `LlmRequest`.
 */
export function assemblePromptRequest(input: PromptAssemblyInput): LlmRequest {
	return assembleInternal(input).request;
}

/**
 * Assemble the LLM request and return detailed metadata about token usage,
 * truncation, and summary injection.
 *
 * The returned `request` respects the token budget: `metadata.promptTokens`
 * ≤ `metadata.effectiveBudget`.
 *
 * @param input  - All inputs required for assembly.
 * @returns The assembled `LlmRequest` and `AssemblyMetadata`.
 */
export function assemblePromptRequestWithMetadata(input: PromptAssemblyInput): {
	request: LlmRequest;
	metadata: AssemblyMetadata;
} {
	return assembleInternal(input);
}
