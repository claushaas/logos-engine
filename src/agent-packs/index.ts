/** Step 10.1 — Agent Pack Planner barrel exports */
export {
	discoverAgentPackDeclarations,
	isAgentPackOutputPathSafe,
	resolveAgentPackOutputPath,
} from './agent-pack-declarations.js';

export {
	createAgentPackPlan,
	summarizeAgentPackPlan,
} from './agent-pack-planner.js';

export type {
	AgentPackAction,
	AgentPackBlocker,
	AgentPackDeclaration,
	AgentPackDeclarationSource,
	AgentPackDependency,
	AgentPackDiagnostic,
	AgentPackKind,
	AgentPackOutputPath,
	AgentPackPlan,
	AgentPackPlanInput,
	AgentPackPlanItem,
	AgentPackPlanOptions,
	AgentPackPlanResult,
	AgentPackReadiness,
	AgentPackReasonCode,
	AgentPackRequiredContext,
	AgentPackSource,
	AgentPackSourceKind,
	AgentPackStatus,
	AgentPackSummary,
} from './agent-pack-types.js';
export {
	AGENT_PACK_KIND_ORDER,
	AGENT_PACK_STATUS_ORDER,
} from './agent-pack-types.js';

// ---------------------------------------------------------------------------
// Step 10.2 — Bounded Context Bundle
// ---------------------------------------------------------------------------

export { buildBoundedContextBundle } from './context-bundle-builder.js';
export type {
	ContextBundle,
	ContextBundleAcceptanceCriterion,
	ContextBundleAcceptanceCriterionInput,
	ContextBundleAssumption,
	ContextBundleAssumptionInput,
	ContextBundleBlocker,
	ContextBundleBuilder,
	ContextBundleCanonicalDocMeta,
	ContextBundleConsistencyFinding,
	ContextBundleConsistencyFindingInput,
	ContextBundleConstraint,
	ContextBundleDecision,
	ContextBundleDecisionInput,
	ContextBundleDiagnostic,
	ContextBundleHypothesis,
	ContextBundleHypothesisInput,
	ContextBundleInput,
	ContextBundleMetadata,
	ContextBundleNonGoal,
	ContextBundleNonGoalInput,
	ContextBundleOpenQuestion,
	ContextBundleOpenQuestionInput,
	ContextBundleOptions,
	ContextBundleRedactionSummary,
	ContextBundleRegisterData,
	ContextBundleRequiredChange,
	ContextBundleRequiredChangeInput,
	ContextBundleRequirement,
	ContextBundleResult,
	ContextBundleRisk,
	ContextBundleRiskInput,
	ContextBundleSection,
	ContextBundleSectionItem,
	ContextBundleSectionKind,
	ContextBundleSizeBudget,
	ContextBundleSizeSummary,
	ContextBundleSource,
	ContextBundleSourceKind,
	ContextBundleStatus,
	ContextBundleTraceabilityEntry,
	ContextBundleTraceabilityEntryInput,
	ContextBundleValidationFinding,
	ContextBundleValidationFindingInput,
} from './context-bundle-model.js';
export {
	DEFAULT_SCOPE_OPTIONS,
	DEFAULT_SIZE_BUDGET,
} from './context-bundle-model.js';
