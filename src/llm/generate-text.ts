// Purpose: Text generation helper.
// What it should do: Wrap generateText with common defaults and logging.
// Why it exists: Centralizes plain text LLM calls.

import type {
	GenerateTextInput,
	GenerateTextOutput,
	LlmClientOptions,
	LlmUsage,
} from './client.js';
import { withRetry } from './retry-policy.js';

// ─── Internal helpers ───────────────────────────────────────────────────────

function assertApiKey(apiKey: string): void {
	if (!apiKey) {
		throw new Error(
			'LLM API key is missing. Set LOGOS_LLM_API_KEY or pass { apiKey } to createLlmClient.',
		);
	}
}

async function makeRequest(
	baseUrl: string,
	apiKey: string,
	body: Record<string, unknown>,
): Promise<Response> {
	const url = `${baseUrl}/chat/completions`;
	const response = await fetch(url, {
		body: JSON.stringify(body),
		headers: {
			Authorization: `Bearer ${apiKey}`,
			'Content-Type': 'application/json',
		},
		method: 'POST',
	});

	if (!response.ok) {
		const errorText = await response
			.text()
			.catch(() => '(unable to read response body)');
		throw new Error(
			`LLM request failed (${response.status} ${response.statusText}): ${errorText}`,
		);
	}

	return response;
}

function extractChoice(data: Record<string, unknown>): Record<string, unknown> {
	const choices = data.choices as Array<Record<string, unknown>> | undefined;
	const choice = choices?.[0];
	if (!choice) {
		throw new Error('LLM response contains no choices.');
	}
	return choice;
}

function extractMessage(
	choice: Record<string, unknown>,
): Record<string, unknown> | null {
	if (typeof choice.message === 'object' && choice.message !== null) {
		return choice.message as Record<string, unknown>;
	}
	return null;
}

function extractUsage(data: Record<string, unknown>): LlmUsage | undefined {
	const usage = data.usage as Record<string, unknown> | undefined;
	if (!usage) return undefined;
	return {
		completionTokens: Number(usage.completion_tokens ?? 0),
		promptTokens: Number(usage.prompt_tokens ?? 0),
		totalTokens: Number(usage.total_tokens ?? 0),
	};
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Send a chat completion request to an OpenAI-compatible provider and return
 * the raw text response.
 */
export async function generateText(
	config: LlmClientOptions,
	input: GenerateTextInput,
): Promise<GenerateTextOutput> {
	assertApiKey(config.apiKey);

	const requestBody: Record<string, unknown> = {
		messages: input.messages,
		model: config.model,
	};

	if (input.temperature !== undefined) {
		requestBody.temperature = input.temperature;
	}
	if (input.maxTokens !== undefined) {
		requestBody.max_tokens = input.maxTokens;
	}
	if (input.topP !== undefined) {
		requestBody.top_p = input.topP;
	}
	if (input.stop !== undefined) {
		requestBody.stop = input.stop;
	}
	if (input.responseFormat !== undefined) {
		requestBody.response_format = input.responseFormat;
	}

	const data = await withRetry(async () => {
		const response = await makeRequest(
			config.baseUrl,
			config.apiKey,
			requestBody,
		);
		return (await response.json()) as Record<string, unknown>;
	}, config.retry);

	const choice = extractChoice(data);
	const message = extractMessage(choice);
	const content: string =
		typeof message?.content === 'string' ? message.content : '';
	const finishReason: string =
		typeof choice.finish_reason === 'string' ? choice.finish_reason : 'unknown';

	const usage = extractUsage(data);

	const output: GenerateTextOutput = {
		content,
		finishReason,
	};
	if (usage) {
		output.usage = usage;
	}
	return output;
}
