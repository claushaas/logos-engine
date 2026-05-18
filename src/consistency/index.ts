/** Step 8.3 — Consistency module barrel exports */

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
