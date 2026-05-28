/**
 * AgentTurnOutput application — translates validated LLM output into
 * deterministic state changes.
 *
 * `applyAgentTurn` is the "apply effects" step in the runtime pipeline.
 * After validation passes (Step 6.1), this function:
 *
 * 1. Appends the assistant message to the active node conversation.
 * 2. Applies the proposed lifecycle transition (if valid).
 * 3. Updates the prompt state (if proposed).
 * 4. Stores a canonical answer draft (if present).
 * 5. Merges completeness evaluation (LLM is advisory).
 * 6. Merges extracted semantic data.
 * 7. Recomputes allowed actions.
 * 8. Recomputes document readiness.
 * 9. Builds and returns a state engine snapshot.
 *
 * **Important:** The LLM `proposedLifecycle` is treated as a proposal.
 * The state engine guards (`isValidTransition`, `applyLifecycleTransition`)
 * still validate the transition before applying.
 *
 * **Critically:** The LLM can NEVER propose `"accepted"` —
 * acceptance must be a user-driven action (docs §12).
 *
 * @see {@link https://logos-engine/docs/06-agent-turn-contract.md §11}
 * @see {@link https://logos-engine/docs/architecture/02-runtime-architecture.md §8}
 */
import type {
	AgentTurnOutput,
	CanonicalAnswerDraft,
	CompletenessState,
	ExtractedNodeData,
	LogosProfile,
	LogosRuntimeState,
	NodeLifecycle,
	NodeMessageMetadata,
	NodeRuntimeState,
	PromptState,
} from '../contracts/index.js';
import { setCanonicalAnswerDraft } from '../conversation-runtime/canonical-answers.js';
import { appendAssistantMessage } from '../conversation-runtime/messages.js';
import {
	generateId,
	type NodeId,
	nowIso,
	type PromptId,
} from '../shared/index.js';
import { getAllowedActions } from '../state-engine/allowed-actions.js';
import { recomputeAllDocumentReadiness } from '../state-engine/document-readiness.js';
import { isValidTransition } from '../state-engine/node-lifecycle.js';
import { buildSnapshot } from '../state-engine/snapshot-builder.js';
import {
	diagnostic,
	type StateDiagnostic,
	type StateEngineResult,
	stateErr,
	stateOk,
} from '../state-engine/types.js';

// ═══════════════════════════════════════════════════════════════════════════
// Public types
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Optional configuration for `applyAgentTurn`.
 *
 * These fields enable attribution of the assistant message
 * to the prompt and model that generated the output.
 */
export type ApplyAgentTurnOptions = {
	/** The prompt template ID that generated this output. */
	readonly promptId?: PromptId;

	/** The model identifier (e.g., "claude-sonnet-4-20250514"). */
	readonly model?: string;

	/** An explicit structured output ID to use. Defaults to a generated ID. */
	readonly structuredOutputId?: string;
};

// ═══════════════════════════════════════════════════════════════════════════
// Diagnostic codes
// ═══════════════════════════════════════════════════════════════════════════

const DIAG_NO_ACTIVE_NODE = 'LOGOS_APPLY_AT_NO_ACTIVE_NODE';
const DIAG_NODE_NOT_IN_STATE = 'LOGOS_APPLY_AT_NODE_NOT_IN_STATE';
const DIAG_PROFILE_MISMATCH = 'LOGOS_APPLY_AT_PROFILE_MISMATCH';
const DIAG_LLM_PROPOSED_ACCEPTED = 'LOGOS_APPLY_AT_LLM_PROPOSED_ACCEPTED';
const DIAG_INVALID_PROPOSED_TRANSITION =
	'LOGOS_APPLY_AT_INVALID_PROPOSED_TRANSITION';
const DIAG_ASSISTANT_MESSAGE_APPENDED =
	'LOGOS_APPLY_AT_ASSISTANT_MESSAGE_APPENDED';
const DIAG_LIFECYCLE_APPLIED = 'LOGOS_APPLY_AT_LIFECYCLE_APPLIED';
const DIAG_PROMPT_STATE_UPDATED = 'LOGOS_APPLY_AT_PROMPT_STATE_UPDATED';
const DIAG_CANONICAL_DRAFT_STORED = 'LOGOS_APPLY_AT_CANONICAL_DRAFT_STORED';
const DIAG_CANONICAL_DRAFT_GUARDED = 'LOGOS_APPLY_AT_CANONICAL_DRAFT_GUARDED';
const DIAG_COMPLETENESS_MERGED = 'LOGOS_APPLY_AT_COMPLETENESS_MERGED';
const DIAG_EXTRACTED_MERGED = 'LOGOS_APPLY_AT_EXTRACTED_MERGED';
const DIAG_TRANSITION_INTENT_LOGGED = 'LOGOS_APPLY_AT_TRANSITION_INTENT_LOGGED';
const DIAG_AGENT_TURN_APPLIED = 'LOGOS_APPLY_AT_AGENT_TURN_APPLIED';

// ═══════════════════════════════════════════════════════════════════════════
// Helper: lifecycle-to-prompt-state mapping
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Map a node lifecycle to its default prompt state.
 */
function lifecycleToPromptState(lifecycle: NodeLifecycle): PromptState {
	const map: Record<NodeLifecycle, PromptState> = {
		accepted: 'accepted',
		active: 'follow_up',
		answered: 'follow_up',
		blocked: 'blocked',
		deferred: 'blocked',
		needs_clarification: 'clarification',
		needs_refinement: 'refinement',
		not_started: 'initial',
		ready_for_synthesis: 'synthesis',
		synthesized: 'review',
	};
	return map[lifecycle];
}

// ═══════════════════════════════════════════════════════════════════════════
// Helper: immutable node state patch
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Patch a single node's runtime state in the immutable state tree.
 *
 * Returns a new `LogosRuntimeState` with `updatedAt` refreshed.
 */
function patchNodeState(
	state: LogosRuntimeState,
	nodeId: NodeId,
	update: Partial<NodeRuntimeState>,
): LogosRuntimeState {
	const existing = state.nodeStates[nodeId];
	if (!existing) return state; // should not happen after guards

	return {
		...state,
		nodeStates: {
			...state.nodeStates,
			[nodeId]: {
				...existing,
				...update,
				updatedAt: nowIso(),
			},
		},
		updatedAt: nowIso(),
	};
}

// ═══════════════════════════════════════════════════════════════════════════
// Helper: merge completeness (LLM advisory)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Merge an LLM's suggested completeness with existing node completeness.
 *
 * The LLM evaluation is **advisory** — it can suggest coverage, but the
 * engine computes `complete` conservatively.
 *
 * - Coverage is shallow-merged: incoming per-topic evals overwrite existing.
 * - `missing` and `weak` are recomputed from merged coverage + incoming arrays.
 * - `blockingIssues` are deduplicated.
 * - `complete` is `true` only when the LLM says complete **and**
 *   merged missing/weak/blocking are all empty.
 */
function mergeCompleteness(
	existing: CompletenessState,
	incoming: CompletenessState,
): CompletenessState {
	// Shallow-merge coverage: incoming overwrites existing per-topic.
	const mergedCoverage: Record<string, 'missing' | 'weak' | 'sufficient'> = {
		...existing.coverage,
		...incoming.coverage,
	};

	// Recompute missing/weak from merged coverage + incoming explicit arrays.
	const missingSet = new Set<string>();
	for (const m of incoming.missing) missingSet.add(m);
	for (const [topic, status] of Object.entries(mergedCoverage)) {
		if (status === 'missing') missingSet.add(topic);
	}

	const weakSet = new Set<string>();
	for (const w of incoming.weak) weakSet.add(w);
	for (const [topic, status] of Object.entries(mergedCoverage)) {
		if (status === 'weak') weakSet.add(topic);
	}

	// Don't allow a topic to be both missing and weak.
	for (const m of missingSet) weakSet.delete(m);

	const mergedMissing = [...missingSet];
	const mergedWeak = [...weakSet];

	// Deduplicate blocking issues.
	const blockingSet = new Set<string>();
	for (const b of existing.blockingIssues) blockingSet.add(b);
	for (const b of incoming.blockingIssues) blockingSet.add(b);

	const mergedBlocking = [...blockingSet];

	// `complete` only if LLM says complete AND no gaps remain.
	const mergedComplete =
		incoming.complete &&
		mergedMissing.length === 0 &&
		mergedWeak.length === 0 &&
		mergedBlocking.length === 0;

	return {
		blockingIssues: mergedBlocking,
		complete: mergedComplete,
		coverage: mergedCoverage,
		missing: mergedMissing,
		weak: mergedWeak,
	};
}

// ═══════════════════════════════════════════════════════════════════════════
// Helper: merge extracted data
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Merge extracted semantic data from the LLM into existing node extracted data.
 *
 * Each category (facts, assumptions, decisions, risks, openQuestions) is
 * merged by deduping existing + incoming arrays.
 */
function mergeExtracted(
	existing: ExtractedNodeData,
	incoming: ExtractedNodeData,
): ExtractedNodeData {
	const dedupe = (a: readonly string[], b: readonly string[]): string[] => {
		const seen = new Set<string>();
		for (const item of a) seen.add(item);
		for (const item of b) seen.add(item);
		return [...seen];
	};

	return {
		assumptions: dedupe(existing.assumptions, incoming.assumptions),
		decisions: dedupe(existing.decisions, incoming.decisions),
		facts: dedupe(existing.facts, incoming.facts),
		openQuestions: dedupe(existing.openQuestions, incoming.openQuestions),
		risks: dedupe(existing.risks, incoming.risks),
	};
}

// ═══════════════════════════════════════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Apply a validated `AgentTurnOutput` to the runtime state.
 *
 * This is the "apply effects" step in the runtime pipeline. It translates
 * the validated LLM output into deterministic state changes. The LLM
 * **proposes** structured data; the state engine **disposes** — it validates,
 * accepts, rejects, or overrides every proposal before mutating state.
 *
 * **Preflight guards** (fail before any state mutation):
 * - Selected profile must match `profile.id`.
 * - `state.activeNodeId` must equal `nodeId`.
 * - The node must have runtime state in `nodeStates`.
 * - If `proposedLifecycle` is `"accepted"`: rejected (LLM cannot accept).
 * - If `proposedLifecycle` is set: `isValidTransition(...)` must pass.
 *
 * **Effects** (applied in order, state threaded immutably):
 * 1. Append assistant message with metadata.
 * 2. Apply lifecycle transition (via `applyLifecycleTransition`).
 * 3. Apply `proposedPromptState` override.
 * 4. Store canonical answer draft (via `setCanonicalAnswerDraft`).
 * 5. Merge completeness evaluation.
 * 6. Merge extracted data.
 * 7. Recompute `allowedActions`.
 * 8. Recompute document readiness.
 * 9. Build and return snapshot.
 *
 * @param state   - The current runtime state (not mutated).
 * @param nodeId  - The active node to apply effects to.
 * @param output  - The validated `AgentTurnOutput` from the LLM.
 * @param profile - The loaded `LogosProfile` for document readiness and snapshot.
 * @param options - Optional attribution metadata.
 * @returns A `StateEngineResult` with updated state and snapshot on success,
 *   or error diagnostics on failure.
 */
export function applyAgentTurn(
	state: LogosRuntimeState,
	nodeId: NodeId,
	output: AgentTurnOutput,
	profile: LogosProfile,
	options: ApplyAgentTurnOptions = {},
): StateEngineResult {
	// ═══════════════════════════════════════════════════════════════════
	// Preflight guards — fail before any mutation
	// ═══════════════════════════════════════════════════════════════════

	// Guard 1: selected profile must match the supplied profile.
	if (
		state.selectedProfileId === null ||
		state.selectedProfileId !== profile.id
	) {
		return stateErr(
			`Profile mismatch: state has "${state.selectedProfileId}" but dispatch received "${profile.id}"`,
			[
				diagnostic(
					DIAG_PROFILE_MISMATCH,
					`applyAgentTurn requires the selected profile "${state.selectedProfileId}" to match the supplied profile "${profile.id}".`,
					'error',
				),
			],
		);
	}

	// Guard 2: activeNodeId must be the target node.
	if (state.activeNodeId === null) {
		return stateErr('No active node selected', [
			diagnostic(
				DIAG_NO_ACTIVE_NODE,
				'applyAgentTurn requires an active node.',
				'error',
			),
		]);
	}

	if (state.activeNodeId !== nodeId) {
		return stateErr(
			`Active node "${state.activeNodeId}" does not match target node "${nodeId}"`,
			[
				diagnostic(
					DIAG_NO_ACTIVE_NODE,
					`applyAgentTurn received nodeId "${nodeId}" but active node is "${state.activeNodeId}".`,
					'error',
					nodeId,
				),
			],
		);
	}

	// Guard 3: the node must have runtime state.
	const existingNode = state.nodeStates[nodeId];
	if (!existingNode) {
		return stateErr(`Node "${nodeId}" has no runtime state`, [
			diagnostic(
				DIAG_NODE_NOT_IN_STATE,
				`Node "${nodeId}" does not exist in the current runtime state. ` +
					'Select a node before applying an agent turn.',
				'error',
				nodeId,
			),
		]);
	}

	const currentLifecycle: NodeLifecycle = existingNode.lifecycle;

	// Guard 4: the LLM can NEVER propose "accepted".
	// Acceptance must be a deliberate user action.
	if (output.proposedLifecycle === 'accepted') {
		return stateErr(
			'LLM proposed lifecycle "accepted" — acceptance must be a user-driven action',
			[
				diagnostic(
					DIAG_LLM_PROPOSED_ACCEPTED,
					`The LLM proposed "accepted" for node "${nodeId}". ` +
						'Only a user-initiated accept action can transition a node to accepted. ' +
						'This is a non-negotiable rule (docs §12).',
					'error',
					nodeId,
				),
			],
		);
	}

	// Guard 5: if proposedLifecycle is set, ensure it is a valid transition.
	if (
		output.proposedLifecycle !== undefined &&
		!isValidTransition(currentLifecycle, output.proposedLifecycle)
	) {
		return stateErr(
			`Invalid proposed lifecycle transition: "${currentLifecycle}" → "${output.proposedLifecycle}"`,
			[
				diagnostic(
					DIAG_INVALID_PROPOSED_TRANSITION,
					`The LLM proposed a lifecycle transition from "${currentLifecycle}" ` +
						`to "${output.proposedLifecycle}" for node "${nodeId}", ` +
						'which is not permitted by the lifecycle state machine.',
					'error',
					nodeId,
				),
			],
		);
	}

	// ═══════════════════════════════════════════════════════════════════
	// All guards passed — apply effects immutably (state threaded)
	// ═══════════════════════════════════════════════════════════════════

	const effectDiags: StateDiagnostic[] = [];

	// Determine the prompt ID to attribute.
	const promptId: PromptId = options.promptId ?? ('agent-turn' as PromptId);

	// Determine the structured output ID.
	const structuredOutputId: string = options.structuredOutputId ?? generateId();

	// ── Step 1: Append assistant message ────────────────────────────
	// Build metadata for the assistant message.
	const currentPromptState: PromptState = existingNode.promptState;

	// Determine final lifecycle for stateAfter metadata.
	// If a proposed lifecycle will be applied, use it; otherwise keep current.
	const finalProposedLifecycle: NodeLifecycle =
		output.proposedLifecycle ?? currentLifecycle;

	const metadata: NodeMessageMetadata = {
		promptId,
		promptState: currentPromptState,
		stateAfter: finalProposedLifecycle,
		stateBefore: currentLifecycle,
		structuredOutputId,
		...(options.model !== undefined ? { model: options.model } : {}),
	};

	const msgResult = appendAssistantMessage(
		state,
		nodeId,
		output.userFacingMessage,
		metadata,
	);

	if (!msgResult.ok) {
		// appendAssistantMessage returns a failed result if guards fail.
		return msgResult;
	}

	let nextState = msgResult.state;

	effectDiags.push(
		diagnostic(
			DIAG_ASSISTANT_MESSAGE_APPENDED,
			`Assistant message appended to node "${nodeId}".`,
			'info',
			nodeId,
		),
	);

	// ── Step 2: Merge completeness evaluation (before lifecycle) ─────
	//
	// Applied BEFORE lifecycle transition so that `ready_for_synthesis`
	// lifecycle patches can see the merged completeness.
	if (output.completenessEvaluation) {
		// biome-ignore lint/style/noNonNullAssertion: guarded by preflight
		const existingCompleteness = nextState.nodeStates[nodeId]!.completeness;
		const merged = mergeCompleteness(
			existingCompleteness,
			output.completenessEvaluation,
		);

		nextState = patchNodeState(nextState, nodeId, {
			completeness: merged,
		});

		effectDiags.push(
			diagnostic(
				DIAG_COMPLETENESS_MERGED,
				`Completeness evaluation merged for node "${nodeId}". ` +
					`Complete: ${merged.complete}, Missing: ${merged.missing.length}, Weak: ${merged.weak.length}.`,
				'info',
				nodeId,
			),
		);
	}

	// ── Step 3: Apply lifecycle transition (if proposed) ─────────────
	//
	// The LLM `proposedLifecycle` is treated as a proposal. The state
	// engine guard (`isValidTransition`) already validated the transition
	// in the preflight phase. We apply it as a local immutable patch
	// rather than calling `applyLifecycleTransition` to:
	//   a) avoid requiring a specific transition event, and
	//   b) avoid re-running completeness guards that already passed.
	if (output.proposedLifecycle !== undefined) {
		const nextLifecycle = output.proposedLifecycle;
		const nextPromptFromLifecycle = lifecycleToPromptState(nextLifecycle);
		const nextAllowed = getAllowedActions(nextLifecycle);

		nextState = patchNodeState(nextState, nodeId, {
			allowedActions: nextAllowed,
			lifecycle: nextLifecycle,
			promptState: output.proposedPromptState ?? nextPromptFromLifecycle,
		});

		effectDiags.push(
			diagnostic(
				DIAG_LIFECYCLE_APPLIED,
				`Node "${nodeId}" lifecycle: "${currentLifecycle}" → "${nextLifecycle}".`,
				'info',
				nodeId,
			),
		);
	}

	// ── Step 4: Apply proposedPromptState (if lifecycle didn't
	//    already set it above) ─────────────────────────────────────────
	if (
		output.proposedPromptState !== undefined &&
		output.proposedLifecycle === undefined &&
		// biome-ignore lint/style/noNonNullAssertion: guarded by preflight
		output.proposedPromptState !== nextState.nodeStates[nodeId]!.promptState
	) {
		nextState = patchNodeState(nextState, nodeId, {
			promptState: output.proposedPromptState,
		});

		effectDiags.push(
			diagnostic(
				DIAG_PROMPT_STATE_UPDATED,
				`Prompt state updated to "${output.proposedPromptState}" for node "${nodeId}".`,
				'info',
				nodeId,
			),
		);
	}

	// ── Step 5: Store canonical answer draft (if present) ────────────
	// `canonicalAnswerDraft` can be undefined (not set), null (LLM
	// cleared), or a draft. Failure is fatal — if validation passed
	// but the storage guard fails, the apply step must reject rather
	// than silently drop the draft.
	if (output.canonicalAnswerDraft != null) {
		let draft: CanonicalAnswerDraft = output.canonicalAnswerDraft;

		// Step 10.3: If the LLM draft has an empty `generatedFromMessageIds`
		// array, derive it from the conversation's user message IDs.
		// This ensures traceability even when the mock provider (or a
		// real LLM) omits the field.
		if (draft.generatedFromMessageIds.length === 0) {
			// Use the node's current conversation from `nextState`
			// (after the assistant message was appended).
			const conv = nextState.nodeStates[nodeId]?.conversation ?? [];
			const userMsgIds = conv.filter((m) => m.role === 'user').map((m) => m.id);
			if (userMsgIds.length > 0) {
				draft = { ...draft, generatedFromMessageIds: userMsgIds };
			}
		}

		const draftResult = setCanonicalAnswerDraft(nextState, nodeId, draft);

		if (!draftResult.ok) {
			return stateErr(
				`Could not store canonical answer draft: ${draftResult.error}`,
				[
					diagnostic(
						DIAG_CANONICAL_DRAFT_GUARDED,
						`Canonical answer draft storage failed for node "${nodeId}": ${draftResult.error}`,
						'error',
						nodeId,
					),
				],
			);
		}

		nextState = draftResult.state;

		effectDiags.push(
			diagnostic(
				DIAG_CANONICAL_DRAFT_STORED,
				`Canonical answer draft stored for node "${nodeId}".`,
				'info',
				nodeId,
			),
		);
	}

	// ── Step 6: Merge extracted data ─────────────────────────────────
	if (output.extracted) {
		// biome-ignore lint/style/noNonNullAssertion: guarded by preflight
		const existingExtracted = nextState.nodeStates[nodeId]!.extracted;
		const merged = mergeExtracted(existingExtracted, output.extracted);

		nextState = patchNodeState(nextState, nodeId, {
			extracted: merged,
		});

		effectDiags.push(
			diagnostic(
				DIAG_EXTRACTED_MERGED,
				`Extracted data merged for node "${nodeId}". ` +
					`Facts: ${merged.facts.length}, Assumptions: ${merged.assumptions.length}, ` +
					`Decisions: ${merged.decisions.length}, Risks: ${merged.risks.length}.`,
				'info',
				nodeId,
			),
		);
	}

	// ── Step 7: Log transition intent (if present) ───────────────────
	if (output.transitionIntent) {
		effectDiags.push(
			diagnostic(
				DIAG_TRANSITION_INTENT_LOGGED,
				`Transition intent: "${output.transitionIntent.event}" — ${output.transitionIntent.reason}`,
				'info',
				nodeId,
			),
		);
	}

	// ── Step 8: Pass through agent diagnostics ───────────────────────
	if (output.diagnostics && output.diagnostics.length > 0) {
		for (const agentDiag of output.diagnostics) {
			effectDiags.push(
				diagnostic(
					`AGENT_${agentDiag.code}`,
					agentDiag.message,
					agentDiag.severity,
					nodeId,
				),
			);
		}
	}

	// ── Step 8: Pass through agent diagnostics ───────────────────────
	if (output.diagnostics && output.diagnostics.length > 0) {
		for (const agentDiag of output.diagnostics) {
			effectDiags.push(
				diagnostic(
					`AGENT_${agentDiag.code}`,
					agentDiag.message,
					agentDiag.severity,
					nodeId,
				),
			);
		}
	}

	// ── Step 9: Recompute allowedActions ─────────────────────────────
	// biome-ignore lint/style/noNonNullAssertion: guarded by preflight
	const updatedNode = nextState.nodeStates[nodeId]!;
	const allowedActions = getAllowedActions(updatedNode.lifecycle);

	nextState = patchNodeState(nextState, nodeId, {
		allowedActions,
	});

	// ── Step 10: Recompute document readiness ────────────────────────
	nextState = recomputeAllDocumentReadiness(nextState, profile);

	// ── Step 11: Build snapshot ──────────────────────────────────────
	effectDiags.push(
		diagnostic(
			DIAG_AGENT_TURN_APPLIED,
			`Agent turn applied to node "${nodeId}".`,
			'info',
			nodeId,
		),
	);

	const snapshot = buildSnapshot(nextState, profile, effectDiags);

	return stateOk(nextState, snapshot);
}
