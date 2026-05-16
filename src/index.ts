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
