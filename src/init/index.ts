/** Init Module — workspace creation API */

export { initWorkspace } from './init-execute.js';
export { planInitWorkspace, preflightInit } from './init-plan.js';
export type {
	InitWorkspaceChangedPath,
	InitWorkspaceCollision,
	InitWorkspaceCollisionKind,
	InitWorkspaceDiagnostic,
	InitWorkspaceDocumentationRootSelection,
	InitWorkspaceMode,
	InitWorkspaceOptions,
	InitWorkspacePlan,
	InitWorkspacePreflightResult,
	InitWorkspaceProfileSelection,
	InitWorkspaceResult,
	InitWorkspaceTargetPaths,
} from './init-types.js';
