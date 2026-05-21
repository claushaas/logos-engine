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

// ---------------------------------------------------------------------------
// Step 10.3 — Agent Pack Renderer & Generation
// ---------------------------------------------------------------------------

export {
	buildAgentPackArtifactRecords,
	generateAgentPacks,
	generateAgentPacksAsync,
} from './agent-pack-generation.js';
export type {
	AgentPackArtifactRecord,
	AgentPackChangedPath,
	AgentPackGenerationInput,
	AgentPackGenerationItem,
	AgentPackGenerationOptions,
	AgentPackGenerationReport,
	AgentPackGenerationResult,
	AgentPackGenerationStatus,
	AgentPackRenderDiagnostic,
	AgentPackRenderedMarkdown,
	AgentPackRenderInput,
	AgentPackRenderMetadata,
	AgentPackRenderOptions,
	AgentPackRenderResult,
	AgentPackRenderSection,
	AgentPackRenderSectionKind,
	AgentPackSecuritySummary,
	AgentPackTemplate,
	AgentPackTemplateKind,
	AgentPackWritePolicy,
} from './agent-pack-render-types.js';
export {
	AGENT_PACK_TEMPLATE_KIND_ORDER,
	mapPackKindToTemplateKind,
	SECTION_SORT_ORDER,
} from './agent-pack-render-types.js';
export { renderAgentPack } from './agent-pack-renderer.js';
export {
	checkAgentPackSecurity,
	isPathTraversalSuspected,
} from './agent-pack-security.js';
export {
	DERIVED_WARNING,
	TEMPLATES,
	UNIVERSAL_CONSTRAINTS,
} from './agent-pack-templates.js';
