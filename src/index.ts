/** Logo Engine — package metadata and scaffold types */

export const PACKAGE_NAME = 'logos-engine';
export const PACKAGE_VERSION = '0.1.0';
export const LOGOS_BINARY_NAME = 'logos';

export type LogosRuntimeMode = 'cli' | 'tui' | 'api';

export interface LogosPackageMetadata {
	name: string;
	version: string;
	binaryName: string;
}

export function getPackageMetadata(): LogosPackageMetadata {
	return {
		binaryName: LOGOS_BINARY_NAME,
		name: PACKAGE_NAME,
		version: PACKAGE_VERSION,
	};
}

export type {
	AgentPackOutputDeclaration,
	ArtifactOutputDeclaration,
	BuildContractGraphOptions,
	BuildContractGraphResult,
	CanonicalOutputDeclaration,
	ContractGraph,
	ContractGraphDiagnostic,
	ContractGraphEdge,
	ContractGraphNode,
	DataOutputDeclaration,
	DependencyReference,
	DependencyReferenceKind,
	DependencyTargetKind,
	ExecutiveOutputDeclaration,
	OutputDeclaration,
	OutputDeclarationKind,
	OutputDeclarationRole,
	StatusTransition,
	StatusTransitionResult,
	StatusValue,
	StatusWorkflow,
} from './profiles/contract-graph.js';
export {
	buildContractGraph,
	buildStatusWorkflow,
	ContractGraphError,
	canTransitionStatus,
} from './profiles/contract-graph.js';
export type {
	DocumentDescriptor,
	DocumentDescriptorDependency,
	DocumentDescriptorId,
	DocumentDescriptorOutput,
	DocumentDescriptorOutputAgentPack,
	DocumentDescriptorOutputArtifact,
	DocumentDescriptorOutputCanonical,
	DocumentDescriptorOutputData,
	DocumentDescriptorOutputExecutive,
	DocumentDescriptorSection,
	DocumentDescriptorStatus,
	DocumentDescriptorValidationError,
	DocumentDescriptorValidationOptions,
	DocumentDescriptorValidationResult,
	DocumentSchema,
	LoadAndValidateDocumentDescriptorOptions,
	SchemaFieldDef,
} from './profiles/document-descriptor.js';
export {
	DocumentDescriptorValidationErrorClass,
	loadAndValidateDocumentDescriptor,
	loadDocumentSchema,
	setDocumentSchemaForValidation,
	validateDocumentDescriptor,
} from './profiles/document-descriptor.js';
export type {
	CanonicalDocumentId,
	DocumentationContract,
	DocumentationContractDiagnostic,
	DocumentationContractIndexEntry,
	DocumentationContractPaths,
	DocumentDescriptorPath,
	LoadDocumentationContractOptions,
	LoadedDocumentDescriptor,
	LoadedPhaseDescriptor,
	PhaseDocumentRef,
	PhaseId,
} from './profiles/documentation-contract.js';
export {
	DocumentationContractError,
	listDocumentationContractIndex,
	loadDocumentationContract,
	relativizeIndexPaths,
} from './profiles/documentation-contract.js';
export type {
	LoadProfileRegistryOptions,
	ProfileAgentPolicy,
	ProfileAxis,
	ProfileDependencyPolicy,
	ProfileGlobalRules,
	ProfileId,
	ProfileOutputModel,
	ProfileOutputModelEntry,
	ProfilePhaseRegistry,
	ProfilePhaseRegistryEntry,
	ProfileQualityModel,
	ProfileRegistry,
	ProfileRegistryDiagnostic,
	ProfileRegistryPaths,
	ProfileRoadmapIntegration,
	ProfileStatusWorkflow,
} from './profiles/profile-registry.js';
export {
	loadProfileRegistry,
	ProfileRegistryError,
	validateProfileRegistry,
} from './profiles/profile-registry.js';
// Step 2.4 — Error, Logging, Dry-Run, and JSON Result Conventions
export type {
	CommandChangedPath,
	CommandError,
	CommandExecutionMode,
	CommandMessage,
	CommandResult,
	CommandResultMetadata,
	CommandStatus,
	CommandWarning,
	CreateCommandResultOptions,
	JsonSerializableCommandResult,
	LoggerOptions,
	LogLevel,
	LogSink,
	MemoryLogSink,
	RedactionOptionsType,
	StructuredError,
	StructuredErrorOptions,
} from './runtime/index.js';
export {
	ConsoleLogSink,
	createCommandResult,
	createStructuredError,
	defaultLogger,
	formatCommandResultForHuman,
	formatStructuredError,
	formatStructuredErrors,
	Logger,
	redactAndRelativize,
	redactString,
	redactValue,
	relativizePaths,
	statusToExitCode,
	toCommandError,
	toJsonSerializable,
} from './runtime/index.js';
export type {
	DetectProjectContextOptions,
	DocumentationRootConfig,
	ProjectContext,
	ProjectContextDiagnostic,
	ProjectContextError,
	ProjectRootDetectionResult,
	ProjectRootKind,
	ProviderConfigStatus,
	WorkspaceConfigDetectionResult,
	WorkspaceDetectionResult,
	WorkspaceInitializationState,
} from './runtime/project-context.js';
export {
	detectProjectContext,
	detectProjectRoot,
	detectWorkspace,
	detectWorkspaceConfig,
	formatInitializationState,
	formatProjectContextLines,
	formatProviderStatus,
} from './runtime/project-context.js';

// Step 3.1 — Workspace State Schemas
export type {
	WorkspaceArtifact,
	WorkspaceAssumption,
	WorkspaceAuditEvent,
	WorkspaceDecision,
	WorkspaceDocumentationRootConfig,
	WorkspaceGenerationRun,
	WorkspaceMigrationRecord,
	WorkspaceOpenQuestion,
	WorkspaceProfileLock,
	WorkspaceProviderConfigReference,
	WorkspaceRisk,
	WorkspaceSession,
	WorkspaceState,
	WorkspaceValidationRun,
} from './state/workspace-state.schema.js';
export {
	ArtifactStatusSchema,
	ArtifactTypeSchema,
	AssumptionStatusSchema,
	DecisionStatusSchema,
	DocumentationRootConfigSchema,
	GenerationRunStatusSchema,
	MigrationStatusSchema,
	OpenQuestionStatusSchema,
	ProfileSourceSchema,
	RiskSeveritySchema,
	RiskStatusSchema,
	SessionStatusSchema,
	SessionTypeSchema,
	TokenSourceSchema,
	ValidationRunStatusSchema,
	WORKSPACE_STATE_SCHEMA_VERSION,
	WorkspaceArtifactSchema,
	WorkspaceAssumptionSchema,
	WorkspaceAuditEventSchema,
	WorkspaceDecisionSchema,
	WorkspaceGenerationRunSchema,
	WorkspaceMetadataSchema,
	WorkspaceMigrationRecordSchema,
	WorkspaceOpenQuestionSchema,
	WorkspaceProfileLockSchema,
	WorkspaceProviderConfigReferenceSchema,
	WorkspaceRiskSchema,
	WorkspaceSessionSchema,
	WorkspaceStateSchema,
	WorkspaceValidationRunSchema,
} from './state/workspace-state.schema.js';
export type { CreateDefaultWorkspaceStateOptions } from './state/workspace-state-defaults.js';
export { createDefaultWorkspaceState } from './state/workspace-state-defaults.js';
export type {
	WorkspaceStateValidationError,
	WorkspaceStateValidationResult,
} from './state/workspace-state-validation.js';
export {
	isLikelyRawSecret,
	parseWorkspaceState,
	redactSecretValue,
	safeParseWorkspaceState,
	validateWorkspaceState,
} from './state/workspace-state-validation.js';
