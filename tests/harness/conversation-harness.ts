/**
 * Deterministic conversation harness — wires the mock LLM provider, state
 * engine dispatch, prompt orchestrator, and AgentTurnOutput application
 * into a pure, test-friendly API for end-to-end flow validation.
 *
 * The harness uses a session registry (keyed by `state.sessionId`) so that
 * `simulateUserTurn`, `simulateAgentTurn`, and `simulateNodeCompletion`
 * can look up the profile and mock provider without the caller threading
 * them explicitly.
 *
 * @see {@link https://logos-engine/docs/13-prototypes.md §4.1-4.10}
 * @see {@link https://logos-engine/docs/architecture/09-testing-architecture.md §12}
 */
import { applyAgentTurn } from '../../src/application/apply-agent-turn.js';
import type {
	CanonicalAnswer,
	GlobalContext,
	LogosProfile,
	LogosRuntimeState,
	NodeDefinition,
	NodeId,
	NodeLifecycle,
	NodeRuntimeState,
	PromptState,
	SessionId,
} from '../../src/contracts/index.js';
import { MockLlmProvider } from '../../src/llm/mock-provider.js';
import {
	assemblePromptRequest,
	type LlmRequest,
} from '../../src/prompt-orchestration/prompt-assembler.js';
import type { PromptDefinition } from '../../src/prompt-orchestration/prompt-registry.js';
import type { DocumentId, ProfileId, PromptId } from '../../src/shared/index.js';
import { dispatch as stateEngineDispatch } from '../../src/state-engine/dispatch.js';
import { createSession } from '../../src/state-engine/state-engine.js';
import type {
	LogosEvent,
	StateEngineResult,
} from '../../src/state-engine/types.js';

// ═══════════════════════════════════════════════════════════════════════════
// Session registry — maps session IDs to profile + mock provider
// ═══════════════════════════════════════════════════════════════════════════

interface RegistryEntry {
	profile: LogosProfile;
	provider: MockLlmProvider;
}

const _registry = new Map<SessionId, RegistryEntry>();

function _getEntry(sessionId: SessionId): RegistryEntry {
	const entry = _registry.get(sessionId);
	if (!entry) {
		throw new Error(
			`Session "${sessionId}" not found in harness registry. ` +
				'Did you call createTestSession()?',
		);
	}
	return entry;
}

function _setEntry(sessionId: SessionId, entry: RegistryEntry): void {
	_registry.set(sessionId, entry);
}

// ═══════════════════════════════════════════════════════════════════════════
// Factory — createTestSession
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create a test session in `idle` mode with no profile or node selected.
 *
 * Registers the profile and a {@link MockLlmProvider} in the harness
 * registry keyed by the session's `sessionId`, so that subsequent calls
 * to {@link simulateUserTurn}, {@link simulateAgentTurn}, and
 * {@link simulateNodeCompletion} can look up the profile and provider
 * from the state alone.
 *
 * @returns `{ state, dispatch }` where `state` is the initial idle state
 *   and `dispatch` is a function `(state, event, profileOverride?)` that
 *   returns a new `StateEngineResult` without mutating the input state.
 *
 * @example
 * ```ts
 * const { state, dispatch } = createTestSession(profile);
 * // Idle state — no profile selected
 * expect(state.mode).toBe('idle');
 *
 * // Select profile
 * const r1 = dispatch(state, { type: 'SELECT_PROFILE', profileId: profile.id });
 * expect(r1.ok).toBe(true);
 * ```
 */
export function createTestSession(profile: LogosProfile): {
	state: LogosRuntimeState;
	dispatch: (
		state: LogosRuntimeState,
		event: LogosEvent,
		profileOverride?: LogosProfile,
	) => StateEngineResult;
} {
	const state = createSession();
	const provider = new MockLlmProvider();
	_setEntry(state.sessionId, { profile, provider });

	return {
		state,
		dispatch: _dispatch,
	};
}

// ═══════════════════════════════════════════════════════════════════════════
// Dispatch helper — pure, threads state explicitly
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Dispatch a {@link LogosEvent} against the given state.
 *
 * Uses the profile registered for `state.sessionId`. Pass
 * `profileOverride` for events like `CHANGE_PROFILE` that target a
 * different profile (the override is also registered so future
 * dispatches use the new profile).
 *
 * This function is **pure**: it does not mutate `state` and returns a
 * new `StateEngineResult`.
 *
 * @param state           - The current runtime state (not mutated).
 * @param event           - The event to dispatch.
 * @param profileOverride - Optional profile override for profile-change events.
 * @returns A `StateEngineResult` with the updated state and optional snapshot.
 */
function _dispatch(
	state: LogosRuntimeState,
	event: LogosEvent,
	profileOverride?: LogosProfile,
): StateEngineResult {
	const entry = _getEntry(state.sessionId);
	const profile = profileOverride ?? entry.profile;

	const result = stateEngineDispatch(state, event, profile);

	// If a profile override was passed, update the registry entry
	// so subsequent dispatches use the new profile.
	if (result.ok && profileOverride) {
		_setEntry(result.state.sessionId, {
			profile: profileOverride,
			provider: entry.provider,
		});
	}

	return result;
}

// ═══════════════════════════════════════════════════════════════════════════
// Internal helpers — prompt assembly
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Build a minimal {@link PromptDefinition} for the given prompt state.
 *
 * Used so the harness can exercise the real {@link assemblePromptRequest}
 * path without requiring a fully populated prompt registry.
 */
function _makePromptDefinition(
	promptState: PromptState,
): PromptDefinition {
	return {
		content:
			'You are a structured documentation assistant. ' +
			'Produce a valid AgentTurnOutput following the attached schema.',
		id: `harness.${promptState}` as PromptId,
		promptState,
		scope: { level: 'global' },
		version: '1.0.0',
	};
}

/**
 * Build a fully assembled {@link LlmRequest} via
 * {@link assemblePromptRequest}, then attach the lifecycle to
 * `request.metadata` so {@link MockLlmProvider} remains deterministic.
 */
function _buildHarnessRequest(
	state: LogosRuntimeState,
	nodeId: NodeId,
	lifecycle: NodeLifecycle,
	profile: LogosProfile,
): LlmRequest {
	const nodeDef: NodeDefinition | undefined = profile.nodes.find(
		(n) => n.id === nodeId,
	);
	if (!nodeDef) {
		// Should never happen after dispatch validates node existence,
		// but safety-fallback to a minimal empty request.
		return {
			systemPrompt: '',
			messages: [],
			schema: {},
			metadata: { lifecycle },
		};
	}

	const nodeState: NodeRuntimeState = state.nodeStates[nodeId]!;

	// Gather accepted dependency answers.
	const acceptedDeps: CanonicalAnswer[] = [];
	for (const depId of nodeState.dependencies.requiredNodeIds) {
		const depState = state.nodeStates[depId];
		if (
			depState?.canonicalAnswer &&
			depState.lifecycle === 'accepted'
		) {
			acceptedDeps.push(depState.canonicalAnswer);
		}
	}

	const allowedActions = nodeState.allowedActions;

	const request = assemblePromptRequest({
		acceptedDependencies: acceptedDeps,
		allowedActions,
		conversationContext: nodeState.conversation,
		globalContext: state.globalContext,
		nodeDefinition: nodeDef,
		nodeRuntimeState: nodeState,
		selectedPrompt: _makePromptDefinition(nodeState.promptState),
	});

	// Attach lifecycle so MockLlmProvider returns the correct fixture.
	return {
		...request,
		metadata: {
			...(request.metadata ?? {}),
			lifecycle,
		},
	};
}

// ═══════════════════════════════════════════════════════════════════════════
// Turn simulation
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Simulate a complete user turn:
 * 1. Dispatch `USER_MESSAGE_ADDED` with the given input.
 * 2. Build a proper `LlmRequest` via {@link assemblePromptRequest}.
 * 3. Query the mock provider for an `AgentTurnOutput`.
 * 4. Apply the agent turn to update state.
 *
 * This function is **pure**: it does not mutate the input state and
 * returns a new `StateEngineResult`.
 *
 * @param state - The current runtime state (must have an active node).
 * @param input - The user's message text.
 * @returns A `StateEngineResult` with the post-turn state and snapshot.
 */
export async function simulateUserTurn(
	state: LogosRuntimeState,
	input: string,
): Promise<StateEngineResult> {
	const nodeId = state.activeNodeId;
	if (nodeId === null) {
		return {
			ok: false as const,
			error: 'No active node selected for user turn',
			diagnostics: [],
		};
	}

	const userResult = _dispatch(state, {
		type: 'USER_MESSAGE_ADDED',
		nodeId,
		content: input,
	} as LogosEvent);

	if (!userResult.ok) return userResult;

	return simulateAgentTurn(userResult.state, nodeId);
}

/**
 * Simulate an agent turn without a preceding user message.
 *
 * Builds a real `LlmRequest` via {@link assemblePromptRequest}, queries
 * the mock provider, and applies the `AgentTurnOutput` via
 * {@link applyAgentTurn}.
 *
 * An optional `lifecycleOverride` lets the caller force the mock
 * provider to return a specific lifecycle fixture (useful for
 * `ready_for_synthesis` → `synthesized` transitions in flow tests).
 *
 * This function is **pure**: it does not mutate the input state and
 * returns a new `StateEngineResult`.
 *
 * @param state            - The current runtime state.
 * @param nodeId           - The node to apply the agent turn to.
 * @param lifecycleOverride - Optional lifecycle to force on the mock
 *   provider's fixture lookup (defaults to the node's current lifecycle).
 * @returns A `StateEngineResult` with the post-turn state and snapshot.
 */
export async function simulateAgentTurn(
	state: LogosRuntimeState,
	nodeId: NodeId,
	lifecycleOverride?: NodeLifecycle,
): Promise<StateEngineResult> {
	const entry = _getEntry(state.sessionId);
	const profile = entry.profile;
	const provider = entry.provider;

	const nodeState = state.nodeStates[nodeId];
	const lifecycle: NodeLifecycle =
		lifecycleOverride ?? nodeState?.lifecycle ?? 'not_started';

	const request = _buildHarnessRequest(
		state,
		nodeId,
		lifecycle,
		profile,
	);

	const agentOutput = await provider.generateStructuredOutput(request);

	return applyAgentTurn(state, nodeId, agentOutput, profile);
}

// ═══════════════════════════════════════════════════════════════════════════
// Node completion simulation
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Simulate driving a node through the entire `not_started → accepted`
 * lifecycle.
 *
 * The harness uses:
 * - `USER_MESSAGE_ADDED` + mock agent turn to enter `active` and
 *   build conversation.
 * - `NODE_LIFECYCLE_CHANGED` to reach `ready_for_synthesis`.
 * - `simulateAgentTurn` with `lifecycleOverride: 'ready_for_synthesis'`
 *   (which returns a fixture with `canonicalAnswerDraft`) to reach
 *   `synthesized`.
 * - `NODE_LIFECYCLE_CHANGED` from `synthesized` to `accepted`.
 *
 * **Note:** The `accepted` transition uses `NODE_LIFECYCLE_CHANGED`
 * because `ACCEPT_CANONICAL_ANSWER` is not yet implemented in
 * `dispatch()` (Phase 10 task). This validates the lifecycle
 * transition and canonical draft persistence — not the future
 * user-driven accept event.
 *
 * This function is **pure**: it does not mutate the input state and
 * returns a new `StateEngineResult`.
 *
 * @param state  - The current runtime state.
 * @param nodeId - The node to drive to completion.
 * @returns A `StateEngineResult` with the final state.
 */
export async function simulateNodeCompletion(
	state: LogosRuntimeState,
	nodeId: NodeId,
): Promise<StateEngineResult> {
	let current = state;

	// Ensure the target node is selected.
	if (current.activeNodeId !== nodeId) {
		const selResult = _dispatch(current, {
			type: 'SELECT_NODE',
			nodeId,
		} as LogosEvent);
		if (!selResult.ok) return selResult;
		current = selResult.state;
	}

	const startLifecycle =
		current.nodeStates[nodeId]?.lifecycle ?? 'not_started';

	// Already accepted — nothing to do.
	if (startLifecycle === 'accepted') {
		return { ok: true as const, state: current };
	}

	// ── Step 1: not_started → active ─────────────────────────────
	if (startLifecycle === 'not_started') {
		const turnResult = await simulateUserTurn(
			current,
			'This is my answer to the opening question.',
		);
		if (!turnResult.ok) return turnResult;
		current = turnResult.state;
	}

	// ── Step 2: active → ready_for_synthesis (forced) ────────────
	const afterTurn = current.nodeStates[nodeId]?.lifecycle;
	if (
		afterTurn !== undefined &&
		afterTurn !== 'ready_for_synthesis' &&
		afterTurn !== 'synthesized' &&
		afterTurn !== 'accepted'
	) {
		const rfsResult = _dispatch(current, {
			type: 'NODE_LIFECYCLE_CHANGED',
			nodeId,
			to: 'ready_for_synthesis' as NodeLifecycle,
		} as LogosEvent);
		if (!rfsResult.ok) return rfsResult;
		current = rfsResult.state;
	}

	// ── Step 3: ready_for_synthesis → synthesized ────────────────
	if (current.nodeStates[nodeId]?.lifecycle === 'ready_for_synthesis') {
		const synthResult = await simulateAgentTurn(
			current,
			nodeId,
			'ready_for_synthesis',
		);
		if (!synthResult.ok) return synthResult;
		current = synthResult.state;
	}

	// ── Step 4: synthesized → accepted ───────────────────────────
	if (current.nodeStates[nodeId]?.lifecycle === 'synthesized') {
		const acceptResult = _dispatch(current, {
			type: 'NODE_LIFECYCLE_CHANGED',
			nodeId,
			to: 'accepted' as NodeLifecycle,
		} as LogosEvent);
		if (!acceptResult.ok) return acceptResult;
		current = acceptResult.state;
	}

	return { ok: true as const, state: current };
}

// ═══════════════════════════════════════════════════════════════════════════
// Test profile factories
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create a minimal single-node profile suitable for flow tests A, B, D.
 */
export function createFlowTestProfile(
	profileId = 'flow-test-profile' as ProfileId,
): LogosProfile {
	return {
		description: 'Flow test profile — single node.',
		documents: [
			{
				id: 'doc-thesis' as DocumentId,
				optionalNodeIds: [],
				order: 1,
				outputPath: '/dev/null',
				phaseId: 'phase-foundation',
				purpose: 'Testing',
				requiredNodeIds: ['node-thesis' as NodeId],
				title: 'Thesis Document',
			},
		],
		id: profileId,
		materializationRules: [],
		nodes: [
			{
				canonicalQuestion:
					'What conviction makes this project necessary?',
				coverageTopics: ['thesis'],
				dependencies: { recommendedNodeIds: [], requiredNodeIds: [] },
				documentId: 'doc-thesis' as DocumentId,
				id: 'node-thesis' as NodeId,
				order: 1,
				phaseId: 'phase-foundation',
				promptRefs: {},
				sufficiencyCriteria: [],
				title: 'Core Thesis',
			},
		],
		phases: [
			{
				id: 'phase-foundation',
				order: 1,
				purpose: 'Foundation',
				title: 'Foundation',
			},
		],
		title: 'Flow Test Profile',
		version: '1.0.0',
	};
}

/**
 * Create a multi-node profile with two independent nodes (no dependencies)
 * suitable for Flow C (sidebar navigation) tests.
 */
export function createMultiNodeProfile(): LogosProfile {
	const profileId = 'multi-node-profile' as ProfileId;
	return {
		description: 'Multi-node test profile — two independent nodes.',
		documents: [
			{
				id: 'doc-thesis' as DocumentId,
				optionalNodeIds: [],
				order: 1,
				outputPath: '/dev/null',
				phaseId: 'phase-foundation',
				purpose: 'Testing',
				requiredNodeIds: [
					'node-thesis' as NodeId,
					'node-tension' as NodeId,
				],
				title: 'Thesis Document',
			},
		],
		id: profileId,
		materializationRules: [],
		nodes: [
			{
				canonicalQuestion:
					'What conviction makes this project necessary?',
				coverageTopics: ['thesis'],
				dependencies: { recommendedNodeIds: [], requiredNodeIds: [] },
				documentId: 'doc-thesis' as DocumentId,
				id: 'node-thesis' as NodeId,
				order: 1,
				phaseId: 'phase-foundation',
				promptRefs: {},
				sufficiencyCriteria: [],
				title: 'Core Thesis',
			},
			{
				canonicalQuestion:
					'What is the central tension this project addresses?',
				coverageTopics: ['tension'],
				dependencies: { recommendedNodeIds: [], requiredNodeIds: [] },
				documentId: 'doc-thesis' as DocumentId,
				id: 'node-tension' as NodeId,
				order: 2,
				phaseId: 'phase-foundation',
				promptRefs: {},
				sufficiencyCriteria: [],
				title: 'Central Tension',
			},
		],
		phases: [
			{
				id: 'phase-foundation',
				order: 1,
				purpose: 'Foundation',
				title: 'Foundation',
			},
		],
		title: 'Multi-Node Test Profile',
		version: '1.0.0',
	};
}
