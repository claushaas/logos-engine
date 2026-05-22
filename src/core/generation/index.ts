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
export type {
	LoadGenerationStateInput,
	LoadGenerationStateResult,
	ParseGenerationStateJsonInput,
	ParseGenerationStateJsonResult,
	SaveGenerationStateInput,
} from './generation-state.js';
export {
	createDefaultGenerationState,
	getLogosGenerationStatePath,
	LOGOS_GENERATION_STATE_FILE_NAME,
	loadGenerationState,
	parseGenerationStateJson,
	saveGenerationState,
	stringifyGenerationState,
} from './generation-state.js';
export type { ManualEditRisk } from './manual-edit-risk.js';
export { detectManualEditRisk } from './manual-edit-risk.js';
export type { PlannedOutput } from './output-contracts.js';
export { deriveOutputOperations } from './output-contracts.js';
export type {
	ResolvedOutputPath,
	ResolveOutputPathInput,
} from './output-paths.js';
export { resolveSafeOutputPath } from './output-paths.js';
export type { OverwriteRiskResult } from './overwrite-risk.js';
export { detectOverwriteRisk } from './overwrite-risk.js';
export type {
	RunGenerationPreflightInput,
	RunGenerationPreflightResult,
} from './preflight.js';
export { runGenerationPreflight } from './preflight.js';
export type {
	GenerationPreflightBlockerCode,
	GenerationPreflightIssue,
	GenerationPreflightMode,
	GenerationPreflightResult,
	GenerationPreflightWarningCode,
	GenerationReadinessStatus,
} from './preflight-result.js';
export type {
	BuildGenerationWritePlanInput,
	BuildGenerationWritePlanResult,
	GenerationOutputAuthority,
	GenerationOutputKind,
	GenerationWriteOperationKind,
	GenerationWritePlan,
	WritePlanOperation,
	WritePlanRisk,
	WriteRiskCode,
} from './write-plan.js';
export { buildGenerationWritePlan } from './write-plan.js';
