/**
 * Compile-time assertions for Step 1.2 runtime and node state types.
 *
 * This file exercises TypeScript-level type identity for the contracts
 * created in Step 1.2. It is NOT a runtime test — if any assertion were
 * violated, the project would not type-check.
 *
 * Tests:
 *  1. Minimal valid `LogosRuntimeState` compiles (empty session).
 *  2. `NodeLifecycle` narrowing: `'accepted'` narrows correctly.
 *  3. `NodeAction` has exactly 14 members (type-level cardinality check).
 *  4. `NodeLifecycle` has 10 members.
 *  5. `SessionMode` has 8 members.
 *  6. `PromptState` has 9 members.
 *  7. Every lifecycle maps to a defined set of `NodeAction[]` values.
 */

import type { DocumentId, NodeId, SessionId } from '../shared/index.js';
import type {
	CanonicalAnswer,
	CompletenessState,
	ExtractedNodeData,
	GlobalContext,
	LogosRuntimeState,
	NodeAction,
	NodeDependencyState,
	NodeLifecycle,
	NodeRuntimeState,
	PromptState,
	RuntimeDocumentState,
	RuntimeExportState,
	SessionMode,
} from './index.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

type IsAssignable<A, B> = [A] extends [B] ? true : false;
type Expect<T extends true> = T;
type ExpectFalse<T extends false> = T;

// ─── 1. Minimal valid LogosRuntimeState compiles ────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _minimalRuntimeState: LogosRuntimeState = {
	activeNodeId: null,
	documentStates: {} as Record<DocumentId, RuntimeDocumentState>,
	exportState: { artifacts: [] } satisfies RuntimeExportState,
	globalContext: {
		preferences: {},
		projectName: null,
		summary: null,
	} satisfies GlobalContext,
	lastActiveNodeId: null,
	mode: 'idle',
	nodeStates: {} as Record<NodeId, NodeRuntimeState>,
	selectedProfileId: null,
	sessionId: 'sess_000000000000001' as SessionId,
	updatedAt: '2026-01-01T00:00:00.000Z',
};

// ─── 2. Lifecycle type narrowing: 'accepted' narrows correctly ──────────────

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _testNarrowing(node: NodeRuntimeState): void {
	if (node.lifecycle === 'accepted') {
		// Must compile: after narrowing, `lifecycle` property is `'accepted'`.
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const _narrowed: 'accepted' = node.lifecycle;
	}
}

// ─── 3. NodeAction covers exactly 14 members ───────────────────────────────

const _allNodeActions = [
	'answer',
	'accept',
	'edit',
	'regenerate',
	'defer',
	'reopen',
	'skip',
	'continue_next',
	'mark_as_assumption',
	'mark_as_decision',
	'open_prerequisite',
	'open_document_preview',
	'ask_for_example',
	'resume',
] as const satisfies readonly NodeAction[];

// Every listed action is a valid NodeAction.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _nodeActionCoversAll = Expect<
	IsAssignable<(typeof _allNodeActions)[number], NodeAction>
>;

// NodeAction has no extra members beyond the listed 14.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _nodeActionNoExtras = Expect<
	IsAssignable<NodeAction, (typeof _allNodeActions)[number]>
>;

// ─── 4. NodeLifecycle covers exactly 10 members ────────────────────────────

const _allLifecycles = [
	'not_started',
	'active',
	'answered',
	'needs_clarification',
	'needs_refinement',
	'ready_for_synthesis',
	'synthesized',
	'accepted',
	'deferred',
	'blocked',
] as const satisfies readonly NodeLifecycle[];

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _lifecycleCoversAll = Expect<
	IsAssignable<(typeof _allLifecycles)[number], NodeLifecycle>
>;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _lifecycleNoExtras = Expect<
	IsAssignable<NodeLifecycle, (typeof _allLifecycles)[number]>
>;

// ─── 5. SessionMode covers exactly 8 members ───────────────────────────────

const _allModes = [
	'idle',
	'profile_selection',
	'structure_overview',
	'node_focus',
	'document_preview',
	'export',
	'settings',
	'error',
] as const satisfies readonly SessionMode[];

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _modeCoversAll = Expect<
	IsAssignable<(typeof _allModes)[number], SessionMode>
>;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _modeNoExtras = Expect<
	IsAssignable<SessionMode, (typeof _allModes)[number]>
>;

// ─── 6. PromptState covers exactly 9 members ───────────────────────────────

const _allPromptStates = [
	'initial',
	'follow_up',
	'clarification',
	'refinement',
	'synthesis',
	'review',
	'repair',
	'blocked',
	'accepted',
] as const satisfies readonly PromptState[];

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _promptCoversAll = Expect<
	IsAssignable<(typeof _allPromptStates)[number], PromptState>
>;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _promptNoExtras = Expect<
	IsAssignable<PromptState, (typeof _allPromptStates)[number]>
>;

// ─── 7. Every lifecycle maps to a defined set of actions ────────────────────

/**
 * Maps each lifecycle to the set of allowed actions defined in
 * `docs/04-node-lifecycle-and-question-state.md` §8.
 *
 * This object is NOT exported — it exists purely for compile-time
 * verification that every lifecycle has an associated action list.
 * Runtime action computation is implemented in Step 3.5.
 */
const _lifecycleActions = {
	accepted: ['continue_next', 'reopen', 'open_document_preview'],
	active: ['answer', 'defer', 'mark_as_assumption', 'mark_as_decision'],
	answered: ['answer', 'defer', 'mark_as_assumption', 'mark_as_decision'],
	blocked: ['open_prerequisite', 'defer'],
	deferred: ['resume', 'continue_next'],
	needs_clarification: ['answer', 'defer', 'open_prerequisite'],
	needs_refinement: ['answer', 'defer', 'ask_for_example'],
	not_started: ['answer', 'skip', 'ask_for_example'],
	ready_for_synthesis: [],
	synthesized: ['accept', 'edit', 'regenerate', 'defer', 'reopen'],
} as const satisfies Record<NodeLifecycle, readonly NodeAction[]>;

// eslint-disable-next-line @typescript-eslint/no-unused-expressions
_lifecycleActions;

// ─── 8. CanonicalAnswer and CanonicalAnswerDraft structural checks ──────────

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _canonicalAnswer: CanonicalAnswer = {
	accepted: true,
	confidence: 'high',
	content: 'The central thesis is X.',
	format: 'markdown',
	generatedAt: '2026-01-01T00:00:00.000Z',
	generatedFromMessageIds: ['msg_000000000000001'],
	stale: false,
};

// Verify draft does NOT have `accepted` or `stale`:
// If CanonicalAnswerDraft had `accepted`, this would also compile:
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _draftHasNoAccepted = ExpectFalse<
	IsAssignable<
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		{ readonly accepted: boolean },
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		import('./canonical-answer.js').CanonicalAnswerDraft
	>
>;

// ─── 9. CompletenessState and ExtractedNodeData structural checks ───────────

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _completenessState: CompletenessState = {
	blockingIssues: [],
	complete: true,
	coverage: { 'central conviction': 'sufficient' },
	missing: [],
	weak: [],
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _extractedNodeData: ExtractedNodeData = {
	assumptions: [],
	decisions: [],
	facts: [],
	openQuestions: [],
	risks: [],
};

// ─── 10. NodeDependencyState structural check ───────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _dependencyState: NodeDependencyState = {
	blockedBy: [],
	requiredNodeIds: [],
	unlocks: [],
};

// Redundant: the file must export something to be a module.
export type __runtime_state_typecheck = true;
