/**
 * Prompt orchestration — centralized prompt registry with hierarchical fallback,
 * lifecycle-based prompt selection, and deterministic context assembly.
 *
 * Exports:
 * - `PromptScopeLevel`, `PromptScope` — scope discriminated union.
 * - `PromptDefinition` — complete prompt template descriptor.
 * - `PromptRegistry`, `PromptRegistryOptions` — register, lookup, and filesystem loading.
 * - `DEFAULT_FALLBACK_PROMPTS` — global fallback prompts for all 9 states.
 * - `PROMPT_STATES` — canonical ordered list of all `PromptState` values.
 * - `selectPrompt` — select prompt by node state, lifecycle, and profile.
 * - `promptStateForLifecycle` — lifecycle → prompt state mapping.
 * - `assemblePromptRequest` — assemble final LLM request with budget enforcement.
 * - `AGENT_TURN_OUTPUT_SCHEMA_REFERENCE` — lightweight schema reference.
 * - `estimateTokens` — deterministic token estimation helper.
 * - `LlmRequest`, `LlmMessage`, `PromptAssemblyInput`, `ProfileMetadata`, `AssemblyMetadata` — types.
 */
export {
	DEFAULT_FALLBACK_PROMPTS,
	PROMPT_STATES,
} from './default-prompts.js';
export {
	AGENT_TURN_OUTPUT_SCHEMA_REFERENCE,
	assemblePromptRequest,
	assemblePromptRequestWithMetadata,
	type AssemblyMetadata,
	estimateTokens,
	type LlmMessage,
	type LlmRequest,
	type ProfileMetadata,
	type PromptAssemblyInput,
} from './prompt-assembler.js';
export {
	type PromptDefinition,
	PromptRegistry,
	type PromptRegistryOptions,
	type PromptScope,
	type PromptScopeLevel,
} from './prompt-registry.js';
export {
	promptStateForLifecycle,
	selectPrompt,
} from './prompt-selector.js';
