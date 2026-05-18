/** Workspace State Defaults — pure default-state builder */

import {
	WORKSPACE_STATE_SCHEMA_VERSION,
	type WorkspaceState,
} from './workspace-state.schema.js';

export interface CreateDefaultWorkspaceStateOptions {
	workspaceId?: string;
	createdAt?: string;
	updatedAt?: string;
	projectRootPath?: string;
	profileId?: string;
	profileVersion?: string;
	documentationRoot?: string;
	providerId?: string;
}

function isDefaultDocumentationRoot(rootPath: string): boolean {
	return rootPath === 'logos/' || rootPath === 'logos';
}

export function createDefaultWorkspaceState(
	options: CreateDefaultWorkspaceStateOptions = {},
): WorkspaceState {
	const now = options.createdAt ?? new Date().toISOString();
	const documentationRoot = options.documentationRoot ?? 'logos/';
	const isDefaultRoot = isDefaultDocumentationRoot(documentationRoot);
	return {
		artifacts: [],
		assumptions: [],
		auditEvents: [],
		claimSourceLinks: [],
		claims: [],
		decisions: [],
		documentation: {
			isDefault: isDefaultRoot,
			rootPath: documentationRoot,
			wasExplicitlyConfigured:
				options.documentationRoot !== undefined && !isDefaultRoot,
		},
		generationRuns: [],
		migrations: [],
		openQuestions: [],
		profile: {
			lockedAt: now,
			profileId: options.profileId ?? 'standard',
			profileVersion: options.profileVersion,
			source: 'bundled',
		},
		proposals: [],
		provider: options.providerId
			? {
					enabled: false,
					providerId: options.providerId,
				}
			: undefined,
		registers: {
			assumptions: [],
			decisions: [],
			hypotheses: [],
			lifecycleEvents: [],
			openQuestions: [],
			risks: [],
		},
		risks: [],
		runs: [],
		schemaVersion: WORKSPACE_STATE_SCHEMA_VERSION,
		sessions: [],
		sources: [],
		validationRuns: [],
		workspace: {
			createdAt: now,
			initializationState: 'uninitialized',
			initializedBy: undefined,
			projectRootPath: options.projectRootPath ?? '.',
			updatedAt: options.updatedAt ?? now,
			workspaceId: options.workspaceId ?? 'workspace-default',
		},
	};
}
