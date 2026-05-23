/**
 * LOGOS Pi Extension — Confirmations module index.
 *
 * Re-exports confirmation detection helpers and adapter-level result
 * creators for partial generation and future confirmation flows.
 */

export type { PartialGenerationConfirmationRequirement } from './partial-generation-confirmation.js';
export {
	createNoUiBlockedResult,
	createPartialGenerationCancelledResult,
	getPartialGenerationConfirmationRequirement,
} from './partial-generation-confirmation.js';
