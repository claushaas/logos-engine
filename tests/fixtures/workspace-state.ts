/** Workspace state test fixtures */

import type { WorkspaceState } from '../../src/state/workspace-state.schema.js';
import { createDefaultWorkspaceState } from '../../src/state/workspace-state-defaults.js';

export function getEmptyWorkspaceState(): WorkspaceState {
	return createDefaultWorkspaceState({
		createdAt: '2024-01-01T00:00:00.000Z',
		projectRootPath: '/tmp/test-repo',
		updatedAt: '2024-01-01T00:00:00.000Z',
		workspaceId: 'test-workspace-001',
	});
}

export function getSampleWorkspaceState(): WorkspaceState {
	const base = createDefaultWorkspaceState({
		createdAt: '2024-06-01T00:00:00.000Z',
		profileId: 'standard',
		profileVersion: '1.0.0',
		projectRootPath: '/tmp/test-repo',
		providerId: 'openai',
		updatedAt: '2024-06-15T12:00:00.000Z',
		workspaceId: 'test-workspace-002',
	});

	return {
		...base,
		artifacts: [
			{
				artifactId: 'art-001',
				artifactType: 'canonical_markdown',
				checksum: 'abc123',
				generatedAt: '2024-06-12T00:10:00.000Z',
				isCanonical: true,
				metadata: { generator: 'v1' },
				path: 'logos/docs/frontend.md',
				runId: 'gen-001',
				sourceDocumentIds: ['docs/frontend'],
				status: 'generated',
			},
		],
		assumptions: [
			{
				affectedDocumentIds: ['docs/frontend'],
				body: 'Target users use browsers supporting ES2022.',
				caveat: 'May need polyfills for corporate environments.',
				createdAt: '2024-06-01T00:00:00.000Z',
				id: 'asm-001',
				sourceRefs: ['session-001'],
				status: 'active',
				title: 'Users have modern browsers',
				updatedAt: '2024-06-01T00:00:00.000Z',
			},
		],
		auditEvents: [
			{
				actor: 'user',
				changedPaths: ['.logos/workspace.json'],
				commandRef: '/init',
				eventId: 'evt-001',
				eventType: 'workspace_initialized',
				summary: 'Workspace initialized with standard profile.',
				targetPath: '.logos/',
				timestamp: '2024-06-01T00:00:00.000Z',
			},
		],
		decisions: [
			{
				affectedDocumentIds: ['docs/frontend'],
				body: 'We decided to use React for the frontend framework.',
				confidence: 'high',
				createdAt: '2024-06-01T00:00:00.000Z',
				id: 'dec-001',
				sourceRefs: ['session-001'],
				status: 'confirmed',
				title: 'Use React for frontend',
				updatedAt: '2024-06-01T00:00:00.000Z',
			},
		],
		documentation: {
			isDefault: true,
			rootPath: 'logos/',
			wasExplicitlyConfigured: false,
		},
		generationRuns: [
			{
				changedPaths: ['logos/docs/frontend.md'],
				command: '/generate',
				completedAt: '2024-06-12T00:10:00.000Z',
				dryRun: false,
				errors: [],
				relatedArtifactIds: ['art-001'],
				runId: 'gen-001',
				runType: 'generation',
				startedAt: '2024-06-12T00:00:00.000Z',
				status: 'complete',
				warnings: [],
			},
		],
		migrations: [
			{
				appliedAt: '2024-06-15T12:00:00.000Z',
				errors: [],
				fromSchemaVersion: '3.0.0',
				migrationId: 'mig-001',
				notes: 'Added provider config reference schema.',
				status: 'applied',
				toSchemaVersion: '3.1.0',
			},
		],
		openQuestions: [
			{
				affectedDocumentIds: ['docs/infrastructure'],
				body: 'Need to decide between Vercel, AWS, or self-hosted.',
				createdAt: '2024-06-01T00:00:00.000Z',
				id: 'q-001',
				question: 'What is the target deployment platform?',
				sourceRefs: ['session-001'],
				status: 'open',
				updatedAt: '2024-06-01T00:00:00.000Z',
			},
		],
		provider: {
			disclosureAcceptedAt: '2024-06-01T00:00:00.000Z',
			enabled: true,
			modelId: 'gpt-4o',
			providerId: 'openai',
			providerName: 'OpenAI',
			tokenEnvVarName: 'OPENAI_API_KEY',
		},
		risks: [
			{
				affectedDocumentIds: ['docs/infrastructure'],
				body: 'If OpenAI changes pricing or terms, migration effort is required.',
				createdAt: '2024-06-01T00:00:00.000Z',
				id: 'risk-001',
				rationale: 'We accept this risk for faster time-to-market.',
				severity: 'medium',
				sourceRefs: ['session-001'],
				status: 'monitored',
				title: 'Vendor lock-in with OpenAI',
				updatedAt: '2024-06-01T00:00:00.000Z',
			},
		],
		sessions: [
			{
				commandOrTrigger: '/continue',
				endedAt: '2024-06-01T01:00:00.000Z',
				relatedArtifactIds: [],
				relatedDecisionIds: ['dec-001'],
				relatedQuestionIds: ['q-001'],
				relatedRunIds: [],
				sessionId: 'session-001',
				sessionType: 'intake',
				startedAt: '2024-06-01T00:00:00.000Z',
				status: 'completed',
				summary: 'Initial project intake completed.',
			},
		],
		validationRuns: [
			{
				changedPaths: [],
				command: '/validate',
				completedAt: '2024-06-10T00:05:00.000Z',
				dryRun: false,
				errors: [],
				findingIds: ['finding-001'],
				relatedArtifactIds: [],
				runId: 'val-001',
				runType: 'validation',
				startedAt: '2024-06-10T00:00:00.000Z',
				status: 'complete',
				warnings: [],
			},
		],
	};
}

export function getInvalidProviderTokenState(): Record<string, unknown> {
	const base = getEmptyWorkspaceState();
	return {
		...base,
		provider: {
			enabled: true,
			providerId: 'openai',
			tokenEnvVarName: 'sk-abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGHIJKLM',
		},
	};
}

export function getInvalidApiKeyState(): Record<string, unknown> {
	const base = getEmptyWorkspaceState();
	return {
		...base,
		provider: {
			apiKeyEnvVarName:
				'sk-ant-api03-abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890abcdefghijklmnop',
			enabled: true,
			providerId: 'anthropic',
		},
	};
}

export function getInvalidBearerState(): Record<string, unknown> {
	const base = getEmptyWorkspaceState();
	return {
		...base,
		provider: {
			enabled: true,
			providerId: 'custom',
			tokenEnvVarName:
				'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U',
		},
	};
}

export function getMissingSchemaVersionState(): Record<string, unknown> {
	const base = getEmptyWorkspaceState();
	const { schemaVersion: _, ...rest } = base;
	return rest;
}

export function getInvalidSchemaVersionState(): Record<string, unknown> {
	const base = getEmptyWorkspaceState();
	return { ...base, schemaVersion: 123 };
}

export function getInvalidDocumentationRootState(): Record<string, unknown> {
	const base = getEmptyWorkspaceState();
	return {
		...base,
		documentation: { ...base.documentation, rootPath: '' },
	};
}

export function getInvalidWorkspaceMetadataState(): Record<string, unknown> {
	const base = getEmptyWorkspaceState();
	return {
		...base,
		workspace: { ...base.workspace, workspaceId: '' },
	};
}
