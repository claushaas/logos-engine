/**
 * OpenAI-compatible LLM provider adapter.
 *
 * Implements {@link LlmProvider} by calling an OpenAI-compatible
 * `/chat/completions` endpoint with structured output
 * (`response_format: json_schema`). Uses the canonical
 * {@link agentTurnOutputJsonSchema} to constrain the model output.
 *
 * ## Provider diagnostics
 *
 * After each call, {@link lastDiagnostics} contains sanitized metadata:
 * provider id, model, base URL host (not full URL), latency, token usage,
 * and finish reason. This data never includes the API key or raw payloads.
 *
 * ## Error handling
 *
 * - Missing API key → `LOGOS_PROVIDER_UNCONFIGURED` (recoverable)
 * - Provider HTTP errors → wrapped as `LOGOS_PROVIDER_ERROR` (`llm_provider`)
 * - JSON parse failures → `LOGOS_JSON_PARSE_FAILED` (`structured_output`)
 * - Missing `userFacingMessage` → `LOGOS_MISSING_USER_FACING_MESSAGE`
 *   (`structured_output`)
 *
 * All error messages are sanitized — they never include the API key value.
 *
 * @see {@link https://logos-engine/docs/architecture/05-llm-integration-architecture.md §4}
 * @see {@link https://logos-engine/docs/15-real-llm-implementation-roadmap.md §LLM-03}
 */
import {
	AGENT_TURN_OUTPUT_SCHEMA_NAME,
	agentTurnOutputJsonSchema,
} from '../contracts/agent-turn.schema.js';
import type { AgentTurnOutput } from '../contracts/index.js';
import type { LlmRequest } from '../prompt-orchestration/prompt-assembler.js';
import { LogosError } from '../shared/errors/LogosError.js';
import type { GenerateTextInput, LlmMessage } from './client.js';
import type { ProviderConfig } from './config.js';
import { resolveApiKey } from './config.js';
import { generateText } from './generate-text.js';
import type { LlmProvider, LlmResponse } from './mock-provider.js';
import { type RedactionDiagnostics, redactLlmRequest } from './redaction.js';

// ═══════════════════════════════════════════════════════════════════════════
// Public types
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Sanitized diagnostics captured after each provider call.
 *
 * Never includes the API key, raw payloads, or full secret-bearing URLs.
 */
export interface ProviderCallDiagnostics {
	/** Provider identifier (e.g., `"openai-compatible"`). */
	readonly provider: string;

	/** Effective model used for this call. */
	readonly model: string;

	/**
	 * Provider base URL hostname (and port if non-default).
	 *
	 * Extracted from `ProviderConfig.baseUrl` — never includes path,
	 * query, or credentials.
	 */
	readonly baseUrlHost: string;

	/** Round-trip latency in milliseconds. */
	readonly latencyMs: number;

	/** Token usage reported by the provider, if available. */
	readonly tokenUsage?: {
		readonly prompt: number;
		readonly completion: number;
		readonly total: number;
	};

	/** Provider-reported finish reason (e.g., `"stop"`, `"length"`). */
	readonly finishReason: string;

	/**
	 * Repair attempt number, if this call is part of a repair loop.
	 *
	 * `undefined` for the initial call. Set by the repair orchestrator
	 * (LLM-10).
	 */
	readonly repairAttempt?: number;

	/**
	 * Redaction diagnostics from the prompt-context redaction pass.
	 *
	 * Present when at least one secret was redacted. The diagnostics
	 * include only per-category match counts — raw matches are never
	 * stored.
	 */
	readonly redaction?: RedactionDiagnostics;
}

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Extract the host (hostname + port if non-default) from a URL string.
 *
 * Returns the raw string unchanged if it cannot be parsed as a URL.
 */
function extractHost(baseUrl: string): string {
	try {
		return new URL(baseUrl).host;
	} catch {
		return baseUrl;
	}
}

/**
 * Convert an {@link LlmRequest} into provider-compatible messages.
 *
 * The `systemPrompt` becomes a `system` message. Each entry in
 * `messages` is passed through with its original role (`user` or
 * `assistant`).
 */
function mapMessages(request: LlmRequest): LlmMessage[] {
	const result: LlmMessage[] = [];

	if (request.systemPrompt) {
		result.push({ content: request.systemPrompt, role: 'system' });
	}

	for (const msg of request.messages) {
		result.push({ content: msg.content, role: msg.role });
	}

	return result;
}

// ═══════════════════════════════════════════════════════════════════════════
// OpenAiCompatibleLlmProvider
// ═══════════════════════════════════════════════════════════════════════════

/**
 * An {@link LlmProvider} that calls an OpenAI-compatible chat completions
 * endpoint with structured JSON Schema output.
 *
 * ## Usage
 *
 * ```ts
 * const config = resolveProviderConfig({ provider: 'openai-compatible' });
 * const provider = new OpenAiCompatibleLlmProvider(config);
 * const output = await provider.generateStructuredOutput(llmRequest);
 * console.log(provider.lastDiagnostics);
 * ```
 *
 * ## Safety
 *
 * - The API key is read at call time from the environment variable
 *   specified by `config.tokenEnv`. It is never stored as an instance
 *   property.
 * - Error messages never include the API key value.
 * - Diagnostics ({@link lastDiagnostics}) include only the hostname,
 *   never the full base URL.
 */
export class OpenAiCompatibleLlmProvider implements LlmProvider {
	private readonly config: ProviderConfig;

	/** Sanitized diagnostics from the most recent call, or `null` before the first call. */
	private _lastDiagnostics: ProviderCallDiagnostics | null = null;

	/**
	 * @param config — Resolved provider configuration. Must have `mode: 'real'`
	 *   and a reachable API token via `config.tokenEnv`.
	 */
	constructor(config: ProviderConfig) {
		this.config = config;
	}

	/** Sanitized diagnostics from the most recent provider call. */
	get lastDiagnostics(): ProviderCallDiagnostics | null {
		return this._lastDiagnostics;
	}

	// ── LlmProvider implementation ────────────────────────────────────

	/**
	 * Send the assembled request to the provider and return the parsed
	 * {@link AgentTurnOutput}.
	 *
	 * Requires disclosure acceptance ({@link ProviderConfig.disclosureAccepted})
	 * before any remote call is attempted. Throws
	 * `LOGOS_DISCLOSURE_NOT_ACCEPTED` if disclosure has not been accepted.
	 *
	 * @throws {@link LogosError} with category `llm_provider` on
	 *   transport/auth/disclosure failures, or `structured_output` on
	 *   parse/validation failures.
	 */
	async generateStructuredOutput(request: LlmRequest): Promise<LlmResponse> {
		// ── Disclosure gate ────────────────────────────────────
		// Remote calls are blocked until the user explicitly accepts the
		// disclosure that their data will be sent to a remote provider.
		// This is a session-local gate — disclosure state is never persisted.
		if (!this.config.disclosureAccepted) {
			throw new LogosError(
				'LOGOS_DISCLOSURE_NOT_ACCEPTED',
				'llm_provider',
				'Remote provider calls require explicit disclosure acceptance. ' +
					'Accept the disclosure before making remote calls to this provider.',
				{ recoverable: true },
			);
		}

		// ── Resolve API key ────────────────────────────────────────
		const apiKey = resolveApiKey(this.config);
		if (!apiKey) {
			throw new LogosError(
				'LOGOS_PROVIDER_UNCONFIGURED',
				'llm_provider',
				`Provider "${this.config.provider}" is unconfigured: no API token found in environment variable ${this.config.tokenEnv}.`,
				{ recoverable: true },
			);
		}

		// ── Determine effective model and temperature ─────────────────
		const effectiveModel = request.model ?? this.config.model;
		const baseUrlHost = extractHost(this.config.baseUrl);

		// ── Redact secrets from prompt context ───────────────────────
		// Redact the assembled LlmRequest before any content leaves
		// the machine. The original `request` is not mutated.
		const redactionResult = redactLlmRequest(request);

		// ── Map messages from the redacted request ───────────────────
		// The system prompt and user/assistant messages have already
		// been redacted, so the provider only sees sanitised content.
		const messages = mapMessages(redactionResult.redacted);

		// ── Build the request ────────────────────────────────────────
		const textInput: GenerateTextInput = {
			messages,
			responseFormat: {
				json_schema: {
					name: AGENT_TURN_OUTPUT_SCHEMA_NAME,
					schema: agentTurnOutputJsonSchema as Record<string, unknown>,
					strict: false,
				},
				type: 'json_schema',
			},
		};

		if (request.temperature !== undefined) {
			textInput.temperature = request.temperature;
		}

		// ── Call the provider ────────────────────────────────────────
		const startMs = Date.now();

		try {
			const result = await generateText(
				{
					apiKey,
					baseUrl: this.config.baseUrl,
					model: effectiveModel,
					retry: this.config.retry,
				},
				textInput,
			);

			const latencyMs = Date.now() - startMs;

			// ── Capture sanitized diagnostics ──────────────────────────
			const diagBase: Omit<
				ProviderCallDiagnostics,
				'tokenUsage' | 'redaction'
			> = {
				baseUrlHost,
				finishReason: result.finishReason,
				latencyMs,
				model: effectiveModel,
				provider: this.config.provider,
			};

			const tokenUsage = result.usage
				? {
						completion: result.usage.completionTokens,
						prompt: result.usage.promptTokens,
						total: result.usage.totalTokens,
					}
				: undefined;

			// Include redaction diagnostics only when secrets were found.
			const redaction =
				redactionResult.diagnostics.totalMatches > 0
					? redactionResult.diagnostics
					: undefined;

			this._lastDiagnostics = {
				baseUrlHost: diagBase.baseUrlHost,
				finishReason: diagBase.finishReason,
				latencyMs: diagBase.latencyMs,
				model: diagBase.model,
				provider: diagBase.provider,
				...(tokenUsage !== undefined ? { tokenUsage } : {}),
				...(redaction !== undefined ? { redaction } : {}),
			};

			// ── Parse JSON response ────────────────────────────────────
			let parsed: unknown;
			try {
				parsed = JSON.parse(result.content);
			} catch (cause) {
				throw new LogosError(
					'LOGOS_JSON_PARSE_FAILED',
					'structured_output',
					'Failed to parse LLM response as JSON.',
					{
						cause,
						details: { finishReason: result.finishReason },
						recoverable: true,
					},
				);
			}

			// ── Validate basic output shape ─────────────────────────────
			if (
				typeof parsed !== 'object' ||
				parsed === null ||
				Array.isArray(parsed)
			) {
				throw new LogosError(
					'LOGOS_INVALID_OUTPUT_SHAPE',
					'structured_output',
					'LLM response is not a JSON object.',
					{ recoverable: true },
				);
			}

			const output = parsed as Record<string, unknown>;

			if (
				typeof output.userFacingMessage !== 'string' ||
				output.userFacingMessage.trim().length === 0
			) {
				throw new LogosError(
					'LOGOS_MISSING_USER_FACING_MESSAGE',
					'structured_output',
					'LLM response is missing a valid userFacingMessage field.',
					{ recoverable: true },
				);
			}

			return output as unknown as AgentTurnOutput;
		} catch (error: unknown) {
			const latencyMs = Date.now() - startMs;

			// ── Re-throw LogosErrors as-is (they already have proper categories) ─
			if (error instanceof LogosError) {
				throw error;
			}

			// ── Wrap unknown errors ─────────────────────────────────────
			const message = error instanceof Error ? error.message : String(error);

			throw new LogosError(
				'LOGOS_PROVIDER_ERROR',
				'llm_provider',
				`Provider "${this.config.provider}" call failed: ${message}`,
				{
					cause: error,
					details: {
						baseUrlHost,
						latencyMs,
						model: effectiveModel,
						provider: this.config.provider,
					},
					recoverable: true,
				},
			);
		}
	}
}
