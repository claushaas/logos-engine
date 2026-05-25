// Purpose: LLM client interface. OpenAI-compatible.
// What it should do: Define provider-agnostic generateText and generateJson methods.
// Why it exists: Keeps LOGOS independent from any single model provider.

import { loadLlmConfig } from './config.js';
import {
	generateStructuredOutput,
	generateStructuredOutputSafe,
	type StructuredOutputInput,
} from './generate-structured-output.js';
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

// ─── Interface ──────────────────────────────────────────────────────────────

export interface LlmClient {
	generateText(input: GenerateTextInput): Promise<GenerateTextOutput>;
	generateStructuredOutput<T>(input: StructuredOutputInput<T>): Promise<T>;
	generateStructuredOutputSafe<T>(
		input: StructuredOutputInput<T>,
	): Promise<import('./response-validation.js').ValidationOutcome<T>>;
}

// ─── Factory ────────────────────────────────────────────────────────────────

/** Create an OpenAI-compatible LLM client. Reads defaults from environment variables. */
export function createLlmClient(
	options?: Partial<LlmClientOptions>,
): LlmClient {
	const resolved = loadLlmConfig(options);

	return {
		generateStructuredOutput: <T>(input: StructuredOutputInput<T>) =>
			generateStructuredOutput(resolved, input),
		generateStructuredOutputSafe: <T>(input: StructuredOutputInput<T>) =>
			generateStructuredOutputSafe(resolved, input),
		generateText: (input) => generateText(resolved, input),
	};
}

// ─── Compatibility stub ─────────────────────────────────────────────────────

export const LlmClient = {
	create: createLlmClient,
};
