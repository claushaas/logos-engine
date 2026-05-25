// Purpose: LLM public API.
// What it should do: Re-export client types and helpers.
// Why it exists: Creates a clean boundary for LLM access.

export {
	createLlmClient,
	type GenerateJsonInput,
	type GenerateTextInput,
	type GenerateTextOutput,
	LlmClient,
	type LlmClientOptions,
	type LlmMessage,
	type LlmUsage,
} from './client.js';

export {
	LlmConfig,
	type LlmConfigData,
	loadLlmConfig,
	validateLlmConfig,
} from './config.js';
export { generateJson } from './generate-json.js';
export {
	generateStructuredOutput,
	generateStructuredOutputSafe,
	type StructuredOutputInput,
} from './generate-structured-output.js';
export { generateText } from './generate-text.js';
export {
	extractIssues,
	formatValidationIssues,
	response_validation,
	tryParseJson,
	type ValidationIssue,
	type ValidationOutcome,
	validateAgainstSchema,
	validateJsonResponse,
} from './response-validation.js';
export {
	backoffDelay,
	DEFAULT_RETRY_CONFIG,
	isRetryable,
	type RetryConfig,
	withRetry,
} from './retry-policy.js';
