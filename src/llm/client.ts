// Purpose: LLM client interface. OpenAI-compatible.
// What it should do: Define provider-agnostic generateText and generateJson methods.
// Why it exists: Keeps LOGOS independent from any single model provider.

import { generateJson } from './generate-json.js';
import { generateText } from './generate-text.js';
import type { RetryConfig } from './retry-policy.js';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface LlmMessage {
	role: 'system' | 'user' | 'assistant';
	content: string;
}

export interface LlmClientOptions {
	baseUrl: string;
	apiKey: string;
	model: string;
	/** Optional retry configuration for transient provider errors. */
	retry?: Partial<RetryConfig>;
}

export interface LlmUsage {
	promptTokens: number;
	completionTokens: number;
	totalTokens: number;
}

export interface GenerateTextInput {
	messages: LlmMessage[];
	temperature?: number;
	maxTokens?: number;
	topP?: number;
	stop?: string[];
	/** OpenAI-compatible `response_format` parameter (e.g. `{ type: "json_schema", json_schema: { … } }`). */
	responseFormat?: Record<string, unknown>;
}

export interface GenerateTextOutput {
	content: string;
	finishReason: string;
	usage?: LlmUsage;
}

export interface GenerateJsonInput<T = unknown> {
	messages: LlmMessage[];
	/** Optional validator (e.g. a Zod schema). Parsed JSON is passed through `schema.parse()`. */
	schema?: { parse(input: unknown): T };
	temperature?: number;
	maxTokens?: number;
}

// ─── Interface ──────────────────────────────────────────────────────────────

export interface LlmClient {
	generateText(input: GenerateTextInput): Promise<GenerateTextOutput>;
	generateJson<T>(input: GenerateJsonInput<T>): Promise<T>;
}

// ─── Factory ────────────────────────────────────────────────────────────────

/** Create an OpenAI-compatible LLM client. Reads defaults from environment variables. */
export function createLlmClient(
	options?: Partial<LlmClientOptions>,
): LlmClient {
	const resolved: LlmClientOptions = {
		apiKey: options?.apiKey ?? process.env.LOGOS_LLM_API_KEY ?? '',
		baseUrl:
			options?.baseUrl ??
			process.env.LOGOS_LLM_BASE_URL ??
			'https://api.openai.com/v1',
		model: options?.model ?? process.env.LOGOS_LLM_MODEL ?? 'gpt-4.1-mini',
	};

	return {
		generateJson: <T>(input: GenerateJsonInput<T>) =>
			generateJson(resolved, input),
		generateText: (input) => generateText(resolved, input),
	};
}

// ─── Compatibility stub ─────────────────────────────────────────────────────

export const LlmClient = {
	create: createLlmClient,
};
