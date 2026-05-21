/** Step 8.3 — Consistency module barrel exports + Step 12.3 — Docs-vs-Code */

export {
	CONSISTENCY_RULE_ORDER,
	getAllConsistencyRules,
	getConsistencyRuleById,
} from './consistency-rules.js';
export type {
	BoundaryViolationKind,
	BoundaryViolationRecord,
	ConsistencyCheckDiagnostic,
	ConsistencyCheckInput,
	ConsistencyCheckOptions,
	ConsistencyCheckResult,
	ConsistencyEvidence,
	ConsistencyEvidenceLink,
	ConsistencyRule,
	ConsistencyRuleCategory,
	ConsistencyRuleId,
	ConsistencySummary,
	ConsistencyViolation,
	ContradictionKind,
	ContradictionRecord,
	ExportReadinessBlocker,
	ExportReadinessStatus,
	GeneratedOutputMetadataEntry,
	GenerationReportSummary,
} from './consistency-types.js';

export { runConsistencyCheck } from './contradiction-detector.js';
export {
	claimKindToCategory,
	extractDocsClaims,
	isScriptMutating,
} from './docs-claim-extraction.js';
export { runDocsCodeConsistencyCheck } from './docs-code-consistency-checker.js';
// Step 12.3 — Docs-vs-Code Consistency
export type {
	DocsCodeArtifactBoundaryCheck,
	DocsCodeBoundaryCheck,
	DocsCodeCategorySummary,
	DocsCodeChangedPath,
	DocsCodeClaim,
	DocsCodeClaimKind,
	DocsCodeClaimSource,
	DocsCodeCommandCheck,
	DocsCodeComparison,
	DocsCodeComparisonStatus,
	DocsCodeConsistencyChecker,
	DocsCodeConsistencyDiagnostic,
	DocsCodeConsistencyFinding,
	DocsCodeConsistencyFindingKind,
	DocsCodeConsistencyInput,
	DocsCodeConsistencyOptions,
	DocsCodeConsistencyReport,
	DocsCodeConsistencyResult,
	DocsCodeConsistencySeverity,
	DocsCodeConsistencySummary,
	DocsCodeEvidence,
	DocsCodeObservedFact,
	DocsCodeObservedFactKind,
	DocsCodeProfileCheck,
	DocsCodeRecoveryHint,
	DocsCodeRootCheck,
	DocsCodeScriptCheck,
	DocsCodeSecurityCheck,
} from './docs-code-consistency-model.js';
export {
	compareSeverity as compareDocsCodeSeverity,
	findingKindToCategory,
	nextDocsCodeId,
	resetDocsCodeIdCounter,
	sortDocsCodeFindings,
} from './docs-code-consistency-model.js';
export { buildDocsCodeConsistencyReport } from './docs-code-consistency-report.js';
export { buildObservedFacts } from './docs-code-observed-facts.js';
