/** Workspace state schema tests */

import { describe, expect, it } from 'vitest';
import { WORKSPACE_STATE_SCHEMA_VERSION } from '../src/state/workspace-state.schema.js';
import { createDefaultWorkspaceState } from '../src/state/workspace-state-defaults.js';
import {
	parseWorkspaceState,
	validateWorkspaceState,
} from '../src/state/workspace-state-validation.js';
import {
	getEmptyWorkspaceState,
	getInvalidDocumentationRootState,
	getInvalidSchemaVersionState,
	getInvalidWorkspaceMetadataState,
	getMissingSchemaVersionState,
	getSampleWorkspaceState,
} from './fixtures/workspace-state.js';

describe('WorkspaceState schema', () => {
	describe('default initialized state', () => {
		it('validates with no errors', () => {
			const state = getEmptyWorkspaceState();
			const result = validateWorkspaceState(state);
			expect(result.success).toBe(true);
			expect(result.errors).toHaveLength(0);
		});

		it('includes schema version', () => {
			const state = getEmptyWorkspaceState();
			expect(state.schemaVersion).toBe(WORKSPACE_STATE_SCHEMA_VERSION);
		});

		it('default documentation root is logos/', () => {
			const state = getEmptyWorkspaceState();
			expect(state.documentation.rootPath).toBe('logos/');
			expect(state.documentation.isDefault).toBe(true);
		});

		it('profile lock defaults to standard', () => {
			const state = getEmptyWorkspaceState();
			expect(state.profile.profileId).toBe('standard');
			expect(state.profile.source).toBe('bundled');
		});

		it('arrays are initialized as valid empty collections', () => {
			const state = getEmptyWorkspaceState();
			expect(state.decisions).toEqual([]);
			expect(state.assumptions).toEqual([]);
			expect(state.openQuestions).toEqual([]);
			expect(state.risks).toEqual([]);
			expect(state.sessions).toEqual([]);
			expect(state.validationRuns).toEqual([]);
			expect(state.generationRuns).toEqual([]);
			expect(state.artifacts).toEqual([]);
			expect(state.auditEvents).toEqual([]);
			expect(state.migrations).toEqual([]);
		});

		it('provider is optional and omitted by default', () => {
			const state = getEmptyWorkspaceState();
			expect(state.provider).toBeUndefined();
		});
	});

	describe('sample populated workspace state', () => {
		it('validates with no errors', () => {
			const state = getSampleWorkspaceState();
			const result = validateWorkspaceState(state);
			expect(result.success).toBe(true);
			expect(result.errors).toHaveLength(0);
		});

		it('has all record types present', () => {
			const state = getSampleWorkspaceState();
			expect(state.decisions).toHaveLength(1);
			expect(state.assumptions).toHaveLength(1);
			expect(state.openQuestions).toHaveLength(1);
			expect(state.risks).toHaveLength(1);
			expect(state.sessions).toHaveLength(1);
			expect(state.validationRuns).toHaveLength(1);
			expect(state.generationRuns).toHaveLength(1);
			expect(state.artifacts).toHaveLength(1);
			expect(state.auditEvents).toHaveLength(1);
			expect(state.migrations).toHaveLength(1);
		});
	});

	describe('validation failures', () => {
		it('fails when schemaVersion is missing', () => {
			const state = getMissingSchemaVersionState();
			const result = validateWorkspaceState(state);
			expect(result.success).toBe(false);
			expect(result.errors.length).toBeGreaterThan(0);
			expect(result.errors.some((e) => e.path === 'schemaVersion')).toBe(true);
		});

		it('fails when schemaVersion is wrong type', () => {
			const state = getInvalidSchemaVersionState();
			const result = validateWorkspaceState(state);
			expect(result.success).toBe(false);
			expect(result.errors.some((e) => e.path === 'schemaVersion')).toBe(true);
		});

		it('fails when schemaVersion is unsupported', () => {
			const state = { ...getEmptyWorkspaceState(), schemaVersion: '999.0.0' };
			const result = validateWorkspaceState(state);
			expect(result.success).toBe(false);
			expect(result.errors.some((e) => e.path === 'schemaVersion')).toBe(true);
		});

		it('fails when workspace metadata is invalid', () => {
			const state = getInvalidWorkspaceMetadataState();
			const result = validateWorkspaceState(state);
			expect(result.success).toBe(false);
			expect(
				result.errors.some((e) => e.path === 'workspace.workspaceId'),
			).toBe(true);
		});

		it('fails when documentation root config is invalid', () => {
			const state = getInvalidDocumentationRootState();
			const result = validateWorkspaceState(state);
			expect(result.success).toBe(false);
			expect(
				result.errors.some((e) => e.path === 'documentation.rootPath'),
			).toBe(true);
		});
	});

	describe('record schema tests', () => {
		it('decision record validates', () => {
			const state = getSampleWorkspaceState();
			expect(state.decisions[0].status).toBe('confirmed');
			expect(state.decisions[0].confidence).toBe('high');
		});

		it('assumption record validates', () => {
			const state = getSampleWorkspaceState();
			expect(state.assumptions[0].status).toBe('active');
			expect(state.assumptions[0].caveat).toBeDefined();
		});

		it('open question record validates', () => {
			const state = getSampleWorkspaceState();
			expect(state.openQuestions[0].status).toBe('open');
		});

		it('risk record validates', () => {
			const state = getSampleWorkspaceState();
			expect(state.risks[0].severity).toBe('medium');
			expect(state.risks[0].status).toBe('monitored');
		});

		it('session record validates', () => {
			const state = getSampleWorkspaceState();
			expect(state.sessions[0].sessionType).toBe('intake');
			expect(state.sessions[0].status).toBe('completed');
		});

		it('validation run record validates', () => {
			const state = getSampleWorkspaceState();
			expect(state.validationRuns[0].runType).toBe('validation');
			expect(state.validationRuns[0].status).toBe('complete');
		});

		it('generation run record validates', () => {
			const state = getSampleWorkspaceState();
			expect(state.generationRuns[0].runType).toBe('generation');
			expect(state.generationRuns[0].status).toBe('complete');
		});

		it('artifact record validates', () => {
			const state = getSampleWorkspaceState();
			expect(state.artifacts[0].artifactType).toBe('canonical_markdown');
			expect(state.artifacts[0].isCanonical).toBe(true);
		});

		it('audit event record validates', () => {
			const state = getSampleWorkspaceState();
			expect(state.auditEvents[0].actor).toBe('user');
			expect(state.auditEvents[0].eventType).toBe('workspace_initialized');
		});

		it('migration record validates', () => {
			const state = getSampleWorkspaceState();
			expect(state.migrations[0].status).toBe('applied');
			expect(state.migrations[0].fromSchemaVersion).toBe('3.0.0');
			expect(state.migrations[0].toSchemaVersion).toBe('3.1.0');
		});
	});

	describe('parseWorkspaceState', () => {
		it('returns valid state for good input', () => {
			const state = getEmptyWorkspaceState();
			const parsed = parseWorkspaceState(state);
			expect(parsed.schemaVersion).toBe(WORKSPACE_STATE_SCHEMA_VERSION);
		});

		it('throws for bad input', () => {
			expect(() => parseWorkspaceState({})).toThrow();
		});
	});

	describe('createDefaultWorkspaceState options', () => {
		it('accepts custom documentation root', () => {
			const state = createDefaultWorkspaceState({ documentationRoot: 'docs/' });
			expect(state.documentation.rootPath).toBe('docs/');
			expect(state.documentation.isDefault).toBe(false);
			expect(state.documentation.wasExplicitlyConfigured).toBe(true);
		});

		it('accepts custom profile', () => {
			const state = createDefaultWorkspaceState({ profileId: 'custom' });
			expect(state.profile.profileId).toBe('custom');
		});

		it('accepts deterministic timestamps', () => {
			const state = createDefaultWorkspaceState({
				createdAt: '2024-01-01T00:00:00.000Z',
				updatedAt: '2024-01-02T00:00:00.000Z',
			});
			expect(state.workspace.createdAt).toBe('2024-01-01T00:00:00.000Z');
			expect(state.workspace.updatedAt).toBe('2024-01-02T00:00:00.000Z');
		});
	});

	describe('snapshot tests', () => {
		it('default initialized state matches snapshot', () => {
			const state = createDefaultWorkspaceState({
				createdAt: '2024-01-01T00:00:00.000Z',
				projectRootPath: '/test/project',
				updatedAt: '2024-01-01T00:00:00.000Z',
				workspaceId: 'snapshot-workspace',
			});
			expect(state).toMatchSnapshot('default-workspace-state');
		});

		it('sample populated state matches snapshot', () => {
			const state = getSampleWorkspaceState();
			expect(state).toMatchSnapshot('sample-workspace-state');
		});
	});
});
