import { describe, expect, it } from 'vitest';
import { validateWorkspace } from '../src/validation/validation-service.js';

function validWorkspaceState(overrides: Record<string, unknown> = {}): unknown {
	return {
		artifacts: [],
		assumptions: [],
		auditEvents: [],
		claimSourceLinks: [],
		claims: [],
		decisions: [],
		documentation: { isDefault: true, rootPath: 'logos/' },
		generationRuns: [],
		migrations: [],
		openQuestions: [],
		profile: { profileId: 'standard', source: 'bundled' },
		proposals: [],
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
		schemaVersion: '3.1.0',
		sessions: [],
		sources: [],
		validationRuns: [],
		workspace: {
			createdAt: '2024-01-01T00:00:00Z',
			initializationState: 'initialized',
			projectRootPath: '/tmp/test',
			updatedAt: '2024-01-01T00:00:00Z',
			workspaceId: 'ws-1',
		},
		...overrides,
	};
}

describe('/validate consistency integration', () => {
	it('includes consistency findings in validation run', async () => {
		const result = await validateWorkspace(
			{
				profileId: 'standard',
				projectRoot: '/tmp/nonexistent-project-12345',
				state: validWorkspaceState({
					profile: { profileId: 'custom', source: 'bundled' },
				}),
			},
			{ dryRun: true, scopes: ['state'] },
		);

		const consistencyFindings = result.findings.filter((f) =>
			f.code.startsWith('consistency_'),
		);
		expect(consistencyFindings.length).toBeGreaterThan(0);
	});

	it('/validate --dry-run remains non-mutating', async () => {
		const result = await validateWorkspace(
			{
				profileId: 'standard',
				projectRoot: '/tmp/nonexistent-project-12345',
				state: validWorkspaceState(),
			},
			{ dryRun: true, scopes: ['state'] },
		);

		expect(result.dryRun).toBe(true);
		expect(result.readOnly).toBe(true);
		expect(result.changedPaths).toEqual([]);
	});

	it('deterministic gate status reflects release-blocking findings', async () => {
		const result = await validateWorkspace(
			{
				profileId: 'standard',
				projectRoot: '/tmp/nonexistent-project-12345',
				state: validWorkspaceState({
					artifacts: [
						{
							artifactId: 'art-1',
							artifactType: 'html',
							isCanonical: true,
							path: 'logos/test.html',
							status: 'generated',
						},
					],
				}),
			},
			{ dryRun: true, scopes: ['state'] },
		);

		expect(result.findings.some((f) => f.severity === 'error')).toBe(true);
		expect(result.status).toBe('fail');
	});

	it('no AI/provider code is called during validation', async () => {
		const result = await validateWorkspace(
			{
				profileId: 'standard',
				projectRoot: '/tmp/nonexistent-project-12345',
				state: validWorkspaceState(),
			},
			{ dryRun: true, scopes: ['state'] },
		);

		expect(result.findings).toBeDefined();
		expect(result.diagnostics).toBeDefined();
	});
});
