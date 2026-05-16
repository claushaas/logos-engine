/** Runtime services */

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
} from './project-context.js';
export {
	detectProjectContext,
	detectProjectRoot,
	detectWorkspace,
	detectWorkspaceConfig,
	formatInitializationState,
	formatProjectContextLines,
	formatProviderStatus,
} from './project-context.js';
