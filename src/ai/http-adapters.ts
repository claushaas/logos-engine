import {
	type LlmProvider,
	LlmProviderError,
	type LlmRequest,
	type LlmResponse,
} from './llm-provider.js';
import {
	type AiProviderConfig,
	getProviderPreset,
	type ResolvedToken,
	resolveProviderConfigDefaults,
	resolveTokenFromEnvironment,
} from './provider-config.js';

type HttpJson = Record<string, unknown>;

export function createOpenAiCompatibleProvider(
	config: AiProviderConfig,
	environment: NodeJS.ProcessEnv = process.env,
): LlmProvider {
	const resolvedConfig = resolveProviderConfigDefaults(config);
	const preset = getProviderPreset(
		resolvedConfig.provider ?? 'openai-compatible',
	);
	const token = resolveTokenFromEnvironment(
		resolvedConfig.tokenSource,
		environment,
	);

	return {
		complete: async (request) => {
			assertConfigured(resolvedConfig, token);
			const endpoint = trimTrailingSlash(resolvedConfig.endpoint);
			const response = await postJson(
				`${endpoint}/chat/completions`,
				{
					messages: request.messages,
					model: resolvedConfig.model,
					response_format: { type: 'json_object' },
				},
				{
					authorizationToken: token.token,
					timeoutMs: resolvedConfig.timeoutMs,
				},
			);

			const choice = getArray(response.choices)[0] as HttpJson | undefined;
			const message = getObject(choice?.message);
			const content = getString(message?.content);

			return createJsonResponse({
				content,
				finishReason: getString(choice?.finish_reason),
				model: getString(response.model) ?? resolvedConfig.model,
				operationId: request.operationId,
				providerId: preset.id,
				usage: getUsage(response.usage),
			});
		},
		metadata: {
			capabilities: preset.capabilities,
			preset,
			providerId: preset.id,
			transmission: preset.transmission,
		},
	};
}

export function createAnthropicCompatibleProvider(
	config: AiProviderConfig,
	environment: NodeJS.ProcessEnv = process.env,
): LlmProvider {
	const resolvedConfig = resolveProviderConfigDefaults(config);
	const preset = getProviderPreset('anthropic');
	const token = resolveTokenFromEnvironment(
		resolvedConfig.tokenSource,
		environment,
	);

	return {
		complete: async (request) => {
			assertConfigured(resolvedConfig, token);
			const endpoint = trimTrailingSlash(resolvedConfig.endpoint);
			const system = request.messages
				.filter((message) => message.role === 'system')
				.map((message) => message.content)
				.join('\n\n');
			const messages = request.messages
				.filter((message) => message.role !== 'system')
				.map((message) => ({
					content: message.content,
					role: message.role,
				}));
			const response = await postJson(
				`${endpoint}/messages`,
				{
					max_tokens: 4096,
					messages,
					model: resolvedConfig.model,
					system: system.length > 0 ? system : undefined,
				},
				{
					anthropicVersion: '2023-06-01',
					authorizationToken: token.token,
					timeoutMs: resolvedConfig.timeoutMs,
				},
			);
			const content = getArray(response.content)
				.map((item) => getObject(item)?.text)
				.filter((text): text is string => typeof text === 'string')
				.join('\n');

			return createJsonResponse({
				content,
				finishReason: getString(response.stop_reason),
				model: getString(response.model) ?? resolvedConfig.model,
				operationId: request.operationId,
				providerId: preset.id,
				usage: getUsage(response.usage),
			});
		},
		metadata: {
			capabilities: preset.capabilities,
			preset,
			providerId: preset.id,
			transmission: preset.transmission,
		},
	};
}

export function createOllamaProvider(config: AiProviderConfig): LlmProvider {
	const resolvedConfig = resolveProviderConfigDefaults(config);
	const preset = getProviderPreset('ollama');

	return {
		complete: async (request) => {
			assertConfigured(resolvedConfig, {
				redacted: null,
				source: { type: 'none' },
				token: null,
			});
			const endpoint = trimTrailingSlash(resolvedConfig.endpoint);
			const response = await postJson(
				`${endpoint}/api/chat`,
				{
					format: 'json',
					messages: request.messages,
					model: resolvedConfig.model,
					stream: false,
				},
				{
					authorizationToken: null,
					timeoutMs: resolvedConfig.timeoutMs,
				},
			);
			const message = getObject(response.message);

			return createJsonResponse({
				content: getString(message?.content),
				finishReason: getString(response.done_reason),
				model: getString(response.model) ?? resolvedConfig.model,
				operationId: request.operationId,
				providerId: preset.id,
				usage: null,
			});
		},
		metadata: {
			capabilities: preset.capabilities,
			preset,
			providerId: preset.id,
			transmission: preset.transmission,
		},
	};
}

function assertConfigured(
	config: AiProviderConfig,
	token: ResolvedToken,
): asserts config is AiProviderConfig & { endpoint: string; model: string } {
	if (!config.enabled) {
		throw new LlmProviderError(
			'AI provider is disabled.',
			'configuration_error',
			false,
		);
	}

	if (!config.endpoint) {
		throw new LlmProviderError(
			'AI provider endpoint is not configured.',
			'configuration_error',
			false,
		);
	}

	if (!config.model) {
		throw new LlmProviderError(
			'AI provider model is not configured.',
			'configuration_error',
			false,
		);
	}

	const preset = config.provider ? getProviderPreset(config.provider) : null;

	if (
		preset?.transmission.requiresUserAcknowledgement &&
		!config.remoteContextDisclosureAccepted
	) {
		throw new LlmProviderError(
			'Remote provider usage requires explicit transmission acknowledgement.',
			'configuration_error',
			false,
		);
	}

	if (preset?.capabilities.requiresToken && !token.token) {
		throw new LlmProviderError(
			'AI provider token was not available from the configured source.',
			'authentication_failed',
			false,
		);
	}
}

async function postJson(
	url: string,
	body: HttpJson,
	options: {
		readonly anthropicVersion?: string;
		readonly authorizationToken: string | null;
		readonly timeoutMs: number | null;
	},
): Promise<HttpJson> {
	const controller = new AbortController();
	const timeout = setTimeout(
		() => controller.abort(),
		options.timeoutMs ?? 60_000,
	);

	try {
		const headers: Record<string, string> = {
			'content-type': 'application/json',
		};

		if (options.authorizationToken) {
			headers.authorization = `Bearer ${options.authorizationToken}`;
			headers['x-api-key'] = options.authorizationToken;
		}

		if (options.anthropicVersion) {
			headers['anthropic-version'] = options.anthropicVersion;
		}

		const response = await fetch(url, {
			body: JSON.stringify(body),
			headers,
			method: 'POST',
			signal: controller.signal,
		});

		if (!response.ok) {
			throw new LlmProviderError(
				`Provider request failed with HTTP ${response.status}.`,
				response.status === 401 || response.status === 403
					? 'authentication_failed'
					: response.status === 429
						? 'rate_limited'
						: 'provider_unavailable',
				response.status >= 500 || response.status === 429,
			);
		}

		const json = (await response.json()) as unknown;

		if (!json || typeof json !== 'object' || Array.isArray(json)) {
			throw new LlmProviderError(
				'Provider returned a non-object JSON response.',
				'invalid_response',
				false,
			);
		}

		return json as HttpJson;
	} catch (error) {
		if (error instanceof LlmProviderError) {
			throw error;
		}

		if (error instanceof Error && error.name === 'AbortError') {
			throw new LlmProviderError(
				'Provider request timed out.',
				'timeout',
				true,
			);
		}

		throw new LlmProviderError(
			error instanceof Error ? error.message : String(error),
			'network_error',
			true,
		);
	} finally {
		clearTimeout(timeout);
	}
}

function createJsonResponse(input: {
	readonly content: string | null;
	readonly finishReason: string | null;
	readonly model: string | null;
	readonly operationId: LlmRequest['operationId'];
	readonly providerId: string;
	readonly usage: LlmResponse['usage'];
}): LlmResponse {
	if (!input.content) {
		throw new LlmProviderError(
			'Provider response did not include message content.',
			'invalid_response',
			false,
		);
	}

	try {
		return {
			finishReason: input.finishReason,
			model: input.model,
			operationId: input.operationId,
			output: JSON.parse(input.content),
			providerId: input.providerId,
			rawText: input.content,
			usage: input.usage,
		};
	} catch {
		throw new LlmProviderError(
			'Provider response content was not valid JSON.',
			'invalid_response',
			false,
		);
	}
}

function getArray(value: unknown): readonly unknown[] {
	return Array.isArray(value) ? value : [];
}

function getObject(value: unknown): HttpJson | null {
	return value && typeof value === 'object' && !Array.isArray(value)
		? (value as HttpJson)
		: null;
}

function getString(value: unknown): string | null {
	return typeof value === 'string' ? value : null;
}

function getUsage(value: unknown): LlmResponse['usage'] {
	const usage = getObject(value);

	if (!usage) {
		return null;
	}

	return {
		inputTokens: getNumber(usage.prompt_tokens ?? usage.input_tokens),
		outputTokens: getNumber(usage.completion_tokens ?? usage.output_tokens),
	};
}

function getNumber(value: unknown): number | null {
	return typeof value === 'number' && Number.isInteger(value) && value >= 0
		? value
		: null;
}

function trimTrailingSlash(value: string | null): string {
	return value?.replaceAll(/\/+$/g, '') ?? '';
}
