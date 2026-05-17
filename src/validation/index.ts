/** Validation module exports for Step 6.1 and Step 6.2 service-layer validation. */

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

// Step 6.2 — Document Completeness and Semantic Lints

export type {
	DocumentSemanticLintContext,
	DocumentSemanticLintInput,
	DocumentSemanticLintOptions,
	DocumentSemanticLintResult,
	DocumentSemanticLintRule,
	DocumentSemanticLintRuleId,
	DocumentSemanticLintRuleResult,
	MarkdownDocumentStructure,
	MarkdownHeadingIndex,
	MarkdownLintDiagnostic,
} from './document-semantic-lints.js';

export {
	createSemanticLintRules,
	lintCanonicalMarkdownDocument,
	lintCanonicalMarkdownDocuments,
	parseMarkdownStructure,
	SEMANTIC_LINT_RULE_REGISTRY,
} from './document-semantic-lints.js';
