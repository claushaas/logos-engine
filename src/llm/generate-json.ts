// Purpose: Structured JSON generation helper.
// What it should do: Call the model, parse JSON, validate schema, and optionally repair invalid output.
// Why it exists: Deterministic prompts need validated structured outputs.

import type {
	GenerateJsonInput,
	GenerateTextInput,
	LlmClientOptions,
	LlmMessage,
} from './client.js';
import { generateText } from './generate-text.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

function buildMessages(
	jsonInstruction: string,
	messages: LlmMessage[],
): LlmMessage[] {
	if (messages.length > 0 && messages[0]?.role === 'system') {
		return [
			{
				content: `${jsonInstruction}\n\n${messages[0]?.content}`,
				role: 'system',
			},
			...messages.slice(1),
		];
	}
	return [{ content: jsonInstruction, role: 'system' }, ...messages];
}

function stripFences(raw: string): string {
	const trimmed = raw.trim();
	const match = trimmed.match(/^```(?:json)?\s*\n([\s\S]*?)\n```$/);
	return match?.[1] ? match[1].trim() : trimmed;
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Request structured JSON output from an OpenAI-compatible provider.
 *
 * An optional `schema` validator (e.g. a Zod schema) can be provided. The
 * parsed JSON is passed through `schema.parse()` before being returned.
 */
export async function generateJson<T>(
	config: LlmClientOptions,
	input: GenerateJsonInput<T>,
): Promise<T> {
	const jsonInstruction =
		'Respond with valid JSON only. No markdown fences, no explanation.';

	const messages = buildMessages(jsonInstruction, input.messages);

	const textInput: GenerateTextInput = {
		messages,
		temperature: input.temperature ?? 0,
	};
	if (input.maxTokens !== undefined) {
		textInput.maxTokens = input.maxTokens;
	}

	const result = await generateText(config, textInput);
	const jsonText = stripFences(result.content);

	let parsed: unknown;
	try {
		parsed = JSON.parse(jsonText);
	} catch (cause) {
		throw new Error(
			`Failed to parse JSON from LLM response: ${cause instanceof Error ? cause.message : String(cause)}`,
		);
	}

	if (input.schema) {
		return input.schema.parse(parsed);
	}

	return parsed as T;
}
