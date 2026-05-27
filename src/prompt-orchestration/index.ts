/**
 * Prompt orchestration — centralized prompt registry with hierarchical fallback
 * and lifecycle-based prompt selection.
 *
 * Exports:
 * - `PromptScopeLevel`, `PromptScope` — scope discriminated union.
 * - `PromptDefinition` — complete prompt template descriptor.
 * - `PromptRegistry`, `PromptRegistryOptions` — register, lookup, and filesystem loading.
 * - `DEFAULT_FALLBACK_PROMPTS` — global fallback prompts for all 9 states.
 * - `PROMPT_STATES` — canonical ordered list of all `PromptState` values.
 * - `selectPrompt` — select prompt by node state, lifecycle, and profile.
 * - `promptStateForLifecycle` — lifecycle → prompt state mapping.
 */
export {
	DEFAULT_FALLBACK_PROMPTS,
	PROMPT_STATES,
} from './default-prompts.js';
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
