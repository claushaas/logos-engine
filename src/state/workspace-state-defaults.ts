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

export function createDefaultWorkspaceState(
	options: CreateDefaultWorkspaceStateOptions = {},
): WorkspaceState {
	const now = options.createdAt ?? new Date().toISOString();
	return {
		artifacts: [],
		assumptions: [],
		auditEvents: [],
		decisions: [],
		documentation: {
			isDefault: true,
			rootPath: options.documentationRoot ?? 'logos/',
			wasExplicitlyConfigured: false,
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
		provider: options.providerId
			? {
					enabled: false,
					providerId: options.providerId,
				}
			: undefined,
		risks: [],
		runs: [],
		schemaVersion: WORKSPACE_STATE_SCHEMA_VERSION,
		sessions: [],
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
