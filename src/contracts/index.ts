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
} from '../shared/index.js';
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
