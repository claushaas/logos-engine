/** Validation module exports for Step 6.1 service-layer validation. */

export type {
	ValidationDiagnostic,
	ValidationFinding,
	ValidationFindingCode,
	ValidationFindingLocation,
	ValidationFindingRecoveryHint,
	ValidationFindingSeverity,
	ValidationFindingSource,
	ValidationGateStatus,
	ValidationRunInput,
	ValidationRunOptions,
	ValidationRunResult,
	ValidationScope,
	ValidationSummary,
	ValidationTarget,
} from './validation-finding.js';

export {
	createValidationFinding,
	createValidationRunResult,
	determineValidationGateStatus,
	looksLikeSecretLikeValue,
	redactSecretLikeString,
	redactValidationValue,
	sortValidationFindings,
	summarizeValidationFindings,
	VALIDATION_FINDING_SORT_ORDER,
} from './validation-finding.js';

export {
	validateArtifactRegistry,
	validateContracts,
	validateGeneratedOutputMetadata,
	validateWorkspace,
	validateWorkspaceState,
	validationSchemas,
} from './validation-service.js';
