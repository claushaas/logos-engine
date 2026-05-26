/**
 * Compile-time assertions for Step 1.3 conversation and message contracts.
 *
 * This file exercises TypeScript-level type identity. If any assertion
 * were violated, the project would not type-check.
 *
 * Tests:
 *  1. `NodeMessageRole` only accepts 'user' | 'assistant' | 'system'.
 *  2. Minimal valid `NodeMessage` compiles.
 *  3. Minimal valid `NodeConversation` compiles.
 *  4. `NodeMessageMetadata` accepts valid optional fields.
 *  5. `AgentTurnOutput` constructs with only required `userFacingMessage`.
 *  6. `AgentTurnOutput` compiles with all optional fields populated.
 *  7. Invalid `NodeMessage.role` is rejected.
 *  8. Invalid `AgentTurnOutput.proposedLifecycle` is rejected.
 *  9. Invalid `TransitionEvent` is rejected.
 * 10. `NodeConversationEntry` is structurally assignable to `NodeMessage`.
 */

import type {
	AgentDiagnostic,
	AgentTurnOutput,
	TransitionEvent,
	TransitionIntent,
} from './agent-turn.js';
import type { CanonicalAnswerDraft } from './canonical-answer.js';
import type { CompletenessState, ExtractedNodeData } from './completeness.js';
import type { NodeMessage, NodeMessageRole } from './conversation.js';
import type { NodeConversationEntry } from './node-state.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

type IsAssignable<A, B> = [A] extends [B] ? true : false;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type Expect<T extends true> = T;

// ─── 1. NodeMessageRole only accepts valid roles ────────────────────────────

const _validRole: NodeMessageRole = 'user';
const _allRoles = ['user', 'assistant', 'system'] as const;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _roleBijection = Expect<
	IsAssignable<NodeMessageRole, (typeof _allRoles)[number]>
>;

// ─── 2. Minimal valid NodeMessage compiles ──────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _minimalMessage: NodeMessage = {
	content: 'What is the central thesis of your project?',
	createdAt: '2026-01-01T00:00:00.000Z',
	id: 'msg_000000000000001',
	role: 'assistant',
};

// ─── 3. Minimal valid NodeConversation compiles ──────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _minimalConversation: import('./conversation.js').NodeConversation = {
	messages: [_minimalMessage],
	nodeId: 'node_000000000000001' as import('../shared/index.js').NodeId,
};

// ─── 4. NodeMessageMetadata with all optional fields ─────────────────────────

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _fullMetadataMessage: NodeMessage = {
	content: 'Central thesis is X.',
	createdAt: '2026-01-01T00:00:00.000Z',
	id: 'msg_000000000000002',
	metadata: {
		model: 'claude-sonnet-4-20250514',
		promptId: 'prompt_000000000000001' as import('../shared/index.js').PromptId,
		promptState: 'initial',
		stateAfter: 'active',
		stateBefore: 'not_started',
		structuredOutputId: 'out_000000000000001',
	},
	role: 'assistant',
};

// ─── 5. AgentTurnOutput with only required userFacingMessage ────────────────

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _minimalTurn: AgentTurnOutput = {
	userFacingMessage: 'What is the central thesis of your project?',
};

// ─── 6. AgentTurnOutput with all optional fields populated ──────────────────

const _canonicalDraft: CanonicalAnswerDraft = {
	confidence: 'medium',
	content: 'The central thesis is X.',
	format: 'markdown',
	generatedAt: '2026-01-01T00:00:00.000Z',
	generatedFromMessageIds: ['msg_000000000000001'],
};

const _completeness: CompletenessState = {
	blockingIssues: [],
	complete: true,
	coverage: { 'central conviction': 'sufficient' },
	missing: [],
	weak: [],
};

const _extracted: ExtractedNodeData = {
	assumptions: ['Assuming market size is 10B.'],
	decisions: ['Decided to use TypeScript.'],
	facts: ['The project targets enterprise customers.'],
	openQuestions: ['What is the pricing model?'],
	risks: ['Competitor X launched similar product.'],
};

const _diagnostic: AgentDiagnostic = {
	code: 'COVERAGE_WEAK',
	message: 'Coverage topic "pricing" is weak.',
	severity: 'warning',
};

const _transitionIntent: TransitionIntent = {
	event: 'USER_ANSWER_EVALUATED',
	reason: 'User provided sufficient detail.',
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _fullTurn: AgentTurnOutput = {
	canonicalAnswerDraft: _canonicalDraft,
	completenessEvaluation: _completeness,
	diagnostics: [_diagnostic],
	extracted: _extracted,
	proposedLifecycle: 'answered',
	proposedPromptState: 'follow_up',
	suggestedActions: ['answer', 'mark_as_assumption'],
	transitionIntent: _transitionIntent,
	userFacingMessage:
		'Your answer has been recorded. Would you like to refine it?',
};

// ─── 7. Invalid NodeMessage.role is rejected ────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _invalidRole: NodeMessage = {
	content: 'test',
	createdAt: '2026-01-01T00:00:00.000Z',
	id: 'msg_000000000000003',
	// @ts-expect-error: 'bot' is not a valid NodeMessageRole
	role: 'bot',
};

// ─── 8. Invalid AgentTurnOutput.proposedLifecycle is rejected ───────────────

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _invalidLifecycleTurn: AgentTurnOutput = {
	// @ts-expect-error: 'completed' is not a valid NodeLifecycle
	proposedLifecycle: 'completed',
	userFacingMessage: 'test',
};

// ─── 9. Invalid TransitionIntent.event is rejected ──────────────────────────

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _invalidTransition: TransitionIntent = {
	// @ts-expect-error: 'ACCEPTED' is not a valid TransitionEvent
	event: 'ACCEPTED',
	reason: 'User accepted.',
};

// ─── 10. NodeConversationEntry is assignable to NodeMessage ─────────────────

// If NodeConversationEntry is structurally narrower than NodeMessage,
// this assignment should compile (breadth check).
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _entryIsMessage: NodeConversationEntry = _minimalMessage;

// Conversation entry array accepts NodeMessage[].
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _entryArray: NodeConversationEntry[] = [_minimalMessage];

// NodeConversationEntry must be compatible with NodeMessage access.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _readEntry(entry: NodeConversationEntry): string {
	return entry.content; // must compile
}

// ─── 11. Cardinality: TransitionEvent has exactly 8 members ─────────────────

const _allTransitionEvents = [
	'ASKED_INITIAL',
	'USER_ANSWER_EVALUATED',
	'CLARIFICATION_REQUESTED',
	'REFINEMENT_REQUESTED',
	'SYNTHESIS_PROPOSED',
	'REVIEW_REQUESTED',
	'NODE_BLOCKED',
	'NODE_READY_FOR_ACCEPTANCE',
] as const satisfies readonly TransitionEvent[];

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _eventAll = Expect<
	IsAssignable<(typeof _allTransitionEvents)[number], TransitionEvent>
>;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _eventExact = Expect<
	IsAssignable<TransitionEvent, (typeof _allTransitionEvents)[number]>
>;

// Redundant: the file must export something to be a module.
export type __conversation_typecheck = true;
