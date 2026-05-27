/**
 * Prompt selector — maps node lifecycle to prompt state and selects the
 * appropriate prompt from the registry using the fallback chain and
 * node-specific overrides.
 *
 * Exports:
 * - `promptStateForLifecycle` — deterministic lifecycle → prompt state mapping.
 * - `selectPrompt` — selects a prompt definition for a given node state.
 */
import type { NodeLifecycle, NodeRuntimeState, PromptState } from '../contracts/node-state.js';
import type { LogosProfile, NodeDefinition, NodePromptRefs } from '../contracts/profile.js';
import type { PromptDefinition, PromptRegistry } from './prompt-registry.js';

// ─── Lifecycle → PromptState mapping ───────────────────────────────────────

/**
 * Map from a `NodeLifecycle` to the corresponding `PromptState` key
 * used to query the prompt registry.
 *
 * Returns `null` for lifecycles that should not produce a prompt
 * (e.g., `deferred` — the node is parked, not awaiting instruction).
 */
export function promptStateForLifecycle(
	lifecycle: NodeLifecycle,
): PromptState | null {
	switch (lifecycle) {
		case 'not_started':
			return 'initial';
		case 'active':
		case 'answered':
			return 'follow_up';
		case 'needs_clarification':
			return 'clarification';
		case 'needs_refinement':
			return 'refinement';
		case 'ready_for_synthesis':
			return 'synthesis';
		case 'synthesized':
			return 'review';
		case 'accepted':
			return 'accepted';
		case 'blocked':
			return 'blocked';
		case 'deferred':
			return null;
	}
}

// ─── Prompt refs field mapping ─────────────────────────────────────────────

/**
 * Map a prompt state to the corresponding field name on `NodePromptRefs`.
 *
 * `NodePromptRefs` uses camelCase field names that align with prompt states
 * but differ in naming convention (e.g., `followUp` vs `follow_up`).
 */
const PROMPT_REFS_FIELD_FOR_STATE: Record<
	PromptState,
	keyof NodePromptRefs | undefined
> = {
	accepted: undefined, // No `accepted` field on NodePromptRefs today.
	blocked: 'blocked',
	clarification: 'clarification',
	follow_up: 'followUp',
	initial: 'initial',
	refinement: 'refinement',
	repair: 'repair',
	review: 'review',
	synthesis: 'synthesis',
};

// ─── Prompt refs resolution ────────────────────────────────────────────────

/**
 * Attempt to resolve a prompt from the node's `promptRefs` overrides.
 *
 * Returns the override prompt if:
 * - The node has a `promptRefs` entry for the given state;
 * - The referenced `PromptId` exists in the registry;
 * - The override's `promptState` matches the expected state.
 *
 * If any check fails, returns `null` so the caller falls back to the
 * standard scope-based lookup chain.
 */
function resolvePromptRef(
	promptRefs: NodePromptRefs | undefined,
	promptState: PromptState,
	registry: PromptRegistry,
): PromptDefinition | null {
	if (!promptRefs) return null;

	const field = PROMPT_REFS_FIELD_FOR_STATE[promptState];
	if (!field) return null;

	const promptId = promptRefs[field];
	if (!promptId) return null;

	const override = registry.getById(promptId);
	if (!override) return null;

	// Sanity: the override must actually be for the expected prompt state.
	// If a node references a `synthesis` prompt for the `review` state,
	// that is a configuration error — fall back instead of selecting
	// the wrong prompt.
	if (override.promptState !== promptState) return null;

	return override;
}

// ─── Primary selection function ────────────────────────────────────────────

/**
 * Select the appropriate prompt definition for a node given its current
 * runtime state, its static definition, and the parent profile.
 *
 * Resolution order:
 * 1. If the lifecycle is `deferred`, return `null` (no prompt needed).
 * 2. Derive the prompt state from the node lifecycle.
 * 3. If the node has a `promptRefs` override for that state and it resolves,
 *    use the override prompt.
 * 4. Otherwise, query the registry using the standard scope-based fallback
 *    chain (node → document → phase → profile → global).
 *
 * @param nodeState  - Runtime state of the node (lifecycle, conversation, etc.).
 * @param nodeDef    - Static node definition (canonical question, promptRefs, etc.).
 * @param profile    - Parent profile (used for profile-scoped prompt lookups).
 * @param registry   - Prompt registry with fallback chain support.
 *
 * @returns The matching `PromptDefinition`, or `null` if none applies.
 */
export function selectPrompt(
	nodeState: NodeRuntimeState,
	nodeDef: NodeDefinition,
	profile: LogosProfile,
	registry: PromptRegistry,
): PromptDefinition | null {
	// 1. Derive prompt state from lifecycle.
	const promptState = promptStateForLifecycle(nodeState.lifecycle);

	// 2. No prompt for deferred nodes.
	if (promptState === null) return null;

	// 3. Check node-level promptRefs overrides.
	const override = resolvePromptRef(nodeDef.promptRefs, promptState, registry);
	if (override) return override;

	// 4. Fall back to scope-based registry lookup.
	return registry.lookup(profile.id, nodeDef.id, promptState);
}
