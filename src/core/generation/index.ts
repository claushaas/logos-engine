/**
 * LOGOS Core — Generation module.
 *
 * Owns completeness calculation, generation preflight, canonical document
 * compilation, and artifact planning.
 * Boundary: must not import Pi, Ink, React, TUI, or CLI modules.
 */

export type { ProfileGenerationContracts } from '../profiles/profile-contracts.js';
export type {
	CalculateIntakeCompletenessInput,
	IntakeCompleteness,
	PhaseCompleteness,
	QuestionCompleteness,
	QuestionCompletenessStatus,
} from './completeness.js';
export { calculateIntakeCompleteness } from './completeness.js';
