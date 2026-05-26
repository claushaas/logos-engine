/**
 * Contracts — shared types and schemas for the LOGOS Engine.
 *
 * Every module in the engine depends on these types.
 * Contracts define structure; runtime modules define behavior.
 */

// Re-export branded domain IDs for convenience (canonical source is @logos/shared).
export type {
	DocumentId,
	NodeId,
	ProfileId,
	PromptId,
	SessionId,
} from '../shared/index.js';

// Step 1.1 — Profile and node definition types.
export type {
	DocumentDefinition,
	DocumentMaterializationRule,
	DocumentMaterializationSectionDefinition,
	LogosProfile,
	NodeDefinition,
	NodeDependencyDefinition,
	NodePromptRefs,
	PhaseDefinition,
} from './profile.js';

// Step 1.2 — Runtime state, node state, canonical answer, and completeness types.
export type { CanonicalAnswer, CanonicalAnswerDraft } from './canonical-answer.js';
export type { CompletenessState, ExtractedNodeData } from './completeness.js';
export type {
	NodeAction,
	NodeConversationEntry,
	NodeDependencyState,
	NodeLifecycle,
	NodeRuntimeState,
	PromptState,
} from './node-state.js';
export type {
	GlobalContext,
	LogosRuntimeState,
	RuntimeDocumentState,
	RuntimeExportState,
	SessionMode,
} from './runtime-state.js';
