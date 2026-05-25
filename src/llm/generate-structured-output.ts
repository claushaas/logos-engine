// Purpose: Structured output generation via JSON Schema.
// What it should do: Use the provider's native `response_format: json_schema`
//                    to guarantee the model output conforms to a given schema.
// Why it exists: Structured outputs are more reliable than prompt-based JSON
//                extraction and eliminate post-hoc parsing fragility.

import type {
	GenerateTextInput,
	LlmClientOptions,
	LlmMessage,
} from './client.js';
import { generateText } from './generate-text.js';
import {
	type ValidationIssue,
	type ValidationOutcome,
	validateAgainstSchema,
} from './response-validation.js';

// ─── Types ───────────────────────────────────────────────────────────────────

/** Input for a structured-output call. */
export interface StructuredOutputInput<T = unknown> {
	/** Chat messages (system, user, assistant). */
	messages: LlmMessage[];
	/**
	 * JSON Schema that the model output must conform to.
	 *
	 * Passed directly as `response_format.json_schema.schema` in the
	 * OpenAI-compatible request body.
	 */
	jsonSchema: Record<string, unknown>;
	/**
	 * Schema name (required by the `json_schema` response format).
	 *
	 * Must match `/^[a-zA-Z0-9_-]{1,64}$/`.
	 */
	schemaName: string;
	/**
	 * Enforce strict adherence to the schema (default: `true`).
	 *
	 * When `true`, all fields in the schema must be `required` and
	 * `additionalProperties: false` is set automatically by the provider.
	 */
	strict?: boolean;
	/**
	 * Optional runtime validator (e.g. a Zod schema).
	 *
	 * Even though the provider guarantees structural conformance, a
	 * second validation pass catches edge cases and provides typed output.
	 */
	schema?: { parse(input: unknown): T };
	/** Sampling temperature (default: `0`). */
	temperature?: number;
	/** Maximum completion tokens. */
	maxTokens?: number;
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Send a structured-output request to an OpenAI-compatible provider.
 *
 * Uses the native `response_format: { type: "json_schema", … }` parameter
 * so the model is constrained to produce JSON matching the supplied schema.
 *
 * An optional runtime `schema` validator can be provided for typed output
 * and an extra safety net.
 */
export async function generateStructuredOutput<T = unknown>(
	config: LlmClientOptions,
	input: StructuredOutputInput<T>,
): Promise<T> {
	const textInput: GenerateTextInput = {
		messages: input.messages,
		responseFormat: {
			json_schema: {
				name: input.schemaName,
				schema: input.jsonSchema,
				strict: input.strict ?? true,
			},
			type: 'json_schema',
		},
		temperature: input.temperature ?? 0,
	};
	if (input.maxTokens !== undefined) {
		textInput.maxTokens = input.maxTokens;
	}

	const result = await generateText(config, textInput);

	let parsed: unknown;
	try {
		parsed = JSON.parse(result.content);
	} catch (cause) {
		throw new Error(
			`Failed to parse structured output JSON: ${cause instanceof Error ? cause.message : String(cause)}`,
		);
	}

	if (input.schema) {
		return input.schema.parse(parsed);
	}

	return parsed as T;
}

/**
 * Like `generateStructuredOutput`, but returns a `ValidationOutcome`
 * instead of throwing on validation failure.
 *
 * Useful when you want to inspect issues without try/catch.
 */
export async function generateStructuredOutputSafe<T>(
	config: LlmClientOptions,
	input: StructuredOutputInput<T>,
): Promise<ValidationOutcome<T>> {
	try {
		const data = await generateStructuredOutput(config, input);
		if (input.schema) {
			// Re-validate to get structured issues
			return validateAgainstSchema(data, input.schema);
		}
		return { data, issues: [], valid: true };
	} catch (error) {
		return {
			data: null,
			issues: extractIssues(error),
			valid: false,
		};
	}
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function extractIssues(error: unknown): ValidationIssue[] {
	if (
		error &&
		typeof error === 'object' &&
		'issues' in error &&
		Array.isArray((error as { issues: unknown }).issues)
	) {
		const zodError = error as {
			issues: Array<{ path?: (string | number)[]; message: string }>;
		};
		return zodError.issues.map((issue) => ({
			message: issue.message,
			path: issue.path ?? [],
		}));
	}

	return [
		{
			message:
				error instanceof Error
					? error.message
					: 'Unknown structured output error',
			path: [],
		},
	];
}
