/** Step 11.3 — Executive Export Adapter Model Tests */

import { describe, expect, it } from 'vitest';
import type {
	ExecutiveExportAdapterKind,
	ExecutiveExportGenerationStatus,
	ExecutiveExportMapping,
	ExecutiveExportResult,
	ExecutiveExportSupportStatus,
	ExecutiveExportTarget,
	ExecutiveExportWritePolicy,
} from '../src/executive/executive-export-model.js';
import {
	ADAPTER_KIND_ORDER,
	isPlannedAdapterContract,
	isSupportedFileExport,
	sortExportTargets,
} from '../src/executive/executive-export-model.js';

// ---------------------------------------------------------------------------
// Adapter kind tests
// ---------------------------------------------------------------------------

describe('ExecutiveExportAdapterKind', () => {
	const allKinds: ExecutiveExportAdapterKind[] = [
		'markdown',
		'html',
		'github_issue_file',
		'agent_pack_file',
		'linear_mapping',
		'notion_mapping',
		'custom',
	];

	it('all adapter kinds are recognized', () => {
		for (const kind of allKinds) {
			expect(kind).toBeDefined();
			expect(typeof kind).toBe('string');
		}
	});

	it('ADAPTER_KIND_ORDER has entries for all kinds', () => {
		for (const kind of allKinds) {
			expect(ADAPTER_KIND_ORDER[kind]).toBeDefined();
		}
	});

	it('adapter kind order is deterministic', () => {
		const sorted = [...allKinds].sort(
			(a, b) => (ADAPTER_KIND_ORDER[a] ?? 99) - (ADAPTER_KIND_ORDER[b] ?? 99),
		);
		expect(sorted[0]).toBe('markdown');
		expect(sorted[1]).toBe('html');
		expect(sorted[2]).toBe('github_issue_file');
		expect(sorted[3]).toBe('agent_pack_file');
		expect(sorted[4]).toBe('linear_mapping');
		expect(sorted[5]).toBe('notion_mapping');
		expect(sorted[6]).toBe('custom');
	});
});

// ---------------------------------------------------------------------------
// Support status tests
// ---------------------------------------------------------------------------

describe('ExecutiveExportSupportStatus', () => {
	const allStatuses: ExecutiveExportSupportStatus[] = [
		'supported_file_export',
		'planned_adapter_contract',
		'unsupported',
		'blocked',
		'unknown',
	];

	it('all support statuses are recognized', () => {
		for (const status of allStatuses) {
			expect(typeof status).toBe('string');
		}
	});

	it('isSupportedFileExport identifies supported exports', () => {
		expect(isSupportedFileExport('supported_file_export')).toBe(true);
		expect(isSupportedFileExport('planned_adapter_contract')).toBe(false);
		expect(isSupportedFileExport('unsupported')).toBe(false);
		expect(isSupportedFileExport('blocked')).toBe(false);
		expect(isSupportedFileExport('unknown')).toBe(false);
	});

	it('isPlannedAdapterContract identifies planned contracts', () => {
		expect(isPlannedAdapterContract('planned_adapter_contract')).toBe(true);
		expect(isPlannedAdapterContract('supported_file_export')).toBe(false);
		expect(isPlannedAdapterContract('unsupported')).toBe(false);
		expect(isPlannedAdapterContract('blocked')).toBe(false);
		expect(isPlannedAdapterContract('unknown')).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// Generation status tests
// ---------------------------------------------------------------------------

describe('ExecutiveExportGenerationStatus', () => {
	const allStatuses: ExecutiveExportGenerationStatus[] = [
		'created',
		'updated',
		'skipped',
		'blocked',
		'requires_review',
		'failed',
	];

	it('all generation statuses are recognized', () => {
		for (const status of allStatuses) {
			expect(typeof status).toBe('string');
			expect(status.length).toBeGreaterThan(0);
		}
	});
});

// ---------------------------------------------------------------------------
// Write policy tests
// ---------------------------------------------------------------------------

describe('ExecutiveExportWritePolicy', () => {
	const allPolicies: ExecutiveExportWritePolicy[] = [
		'skip_existing',
		'fail_on_collision',
		'backup_and_write',
		'explicit_overwrite',
	];

	it('all write policies are recognized', () => {
		for (const policy of allPolicies) {
			expect(typeof policy).toBe('string');
		}
	});
});

// ---------------------------------------------------------------------------
// Sort export targets tests
// ---------------------------------------------------------------------------

describe('sortExportTargets', () => {
	it('sorts targets by adapter kind order', () => {
		const targets: ExecutiveExportTarget[] = [
			{
				adapterKind: 'html',
				enabled: true,
				mapping: {} as ExecutiveExportMapping,
				name: 'HTML',
				supportStatus: 'supported_file_export',
				targetId: 'html-export',
			},
			{
				adapterKind: 'markdown',
				enabled: true,
				mapping: {} as ExecutiveExportMapping,
				name: 'Markdown',
				supportStatus: 'supported_file_export',
				targetId: 'md-export',
			},
			{
				adapterKind: 'notion_mapping',
				enabled: false,
				mapping: {} as ExecutiveExportMapping,
				name: 'Notion',
				supportStatus: 'planned_adapter_contract',
				targetId: 'notion-export',
			},
		];

		const sorted = sortExportTargets(targets);
		expect(sorted[0]?.adapterKind).toBe('markdown');
		expect(sorted[1]?.adapterKind).toBe('html');
		expect(sorted[2]?.adapterKind).toBe('notion_mapping');
	});

	it('sorts by targetId when adapter kinds are equal', () => {
		const targets: ExecutiveExportTarget[] = [
			{
				adapterKind: 'markdown',
				enabled: true,
				mapping: { mappingId: 'c' } as ExecutiveExportMapping,
				name: 'C',
				supportStatus: 'supported_file_export',
				targetId: 'c-export',
			},
			{
				adapterKind: 'markdown',
				enabled: true,
				mapping: { mappingId: 'a' } as ExecutiveExportMapping,
				name: 'A',
				supportStatus: 'supported_file_export',
				targetId: 'a-export',
			},
		];

		const sorted = sortExportTargets(targets);
		expect(sorted[0]?.targetId).toBe('a-export');
		expect(sorted[1]?.targetId).toBe('c-export');
	});

	it('returns a new array (does not mutate)', () => {
		const targets: ExecutiveExportTarget[] = [
			{
				adapterKind: 'html',
				enabled: true,
				mapping: {} as ExecutiveExportMapping,
				name: 'HTML',
				supportStatus: 'supported_file_export',
				targetId: 'html-export',
			},
		];
		const sorted = sortExportTargets(targets);
		expect(sorted).not.toBe(targets);
		expect(sorted).toHaveLength(targets.length);
	});
});

// ---------------------------------------------------------------------------
// Export result shape tests
// ---------------------------------------------------------------------------

describe('ExecutiveExportResult (shape contract)', () => {
	it('result shape includes required fields', () => {
		const result: ExecutiveExportResult = {
			adapterKind: 'markdown',
			changedPaths: [],
			diagnostics: [],
			metadata: {
				derivedSnapshot: true,
				externalApiExecution: false,
				generatedAt: '2026-05-19T00:00:00.000Z',
				nonCanonical: true,
				profileId: 'standard',
				profileVersion: '1.0.0',
				readinessStatus: 'ready',
				schemaValidationStatus: 'passed',
				sourceCanonicalDocumentIds: ['thesis'],
				sourceCanonicalPaths: ['logos/01-foundation/thesis.md'],
				sourcePlanFingerprint: 'abc123',
				sourcePlanId: 'exec-plan-standard-abc12345',
			},
			readOnly: true,
			renderedFiles: [],
			securitySummary: {
				checks: [{ checkId: 'test', name: 'Test', passed: true }],
				passed: true,
			},
			supportStatus: 'supported_file_export',
			targetId: 'test-target',
			title: 'Test Export',
		};

		expect(result.targetId).toBe('test-target');
		expect(result.adapterKind).toBe('markdown');
		expect(result.changedPaths).toEqual([]);
		expect(result.readOnly).toBe(true);
		expect(result.metadata.derivedSnapshot).toBe(true);
		expect(result.metadata.nonCanonical).toBe(true);
		expect(result.metadata.externalApiExecution).toBe(false);
	});

	it('pure adapter changed paths are empty', () => {
		const result: ExecutiveExportResult = {
			adapterKind: 'html',
			changedPaths: [],
			diagnostics: [],
			metadata: {
				derivedSnapshot: true,
				externalApiExecution: false,
				generatedAt: '2026-05-19T00:00:00.000Z',
				nonCanonical: true,
				profileId: 'standard',
				profileVersion: undefined,
				readinessStatus: 'ready',
				schemaValidationStatus: 'passed',
				sourceCanonicalDocumentIds: [],
				sourceCanonicalPaths: [],
				sourcePlanFingerprint: 'abc',
				sourcePlanId: 'plan-id',
			},
			readOnly: true,
			renderedFiles: [],
			securitySummary: {
				checks: [],
				passed: true,
			},
			supportStatus: 'supported_file_export',
			targetId: 'test',
			title: 'Test',
		};
		expect(result.changedPaths).toHaveLength(0);
	});

	it('read-only marker is present for pure rendering', () => {
		const result: ExecutiveExportResult = {
			adapterKind: 'github_issue_file',
			changedPaths: [],
			diagnostics: [],
			metadata: {
				derivedSnapshot: true,
				externalApiExecution: false,
				generatedAt: '2026-05-19T00:00:00.000Z',
				nonCanonical: true,
				profileId: 'standard',
				profileVersion: undefined,
				readinessStatus: 'ready',
				schemaValidationStatus: 'passed',
				sourceCanonicalDocumentIds: [],
				sourceCanonicalPaths: [],
				sourcePlanFingerprint: 'abc',
				sourcePlanId: 'plan-id',
			},
			readOnly: true,
			renderedFiles: [],
			securitySummary: {
				checks: [],
				passed: true,
			},
			supportStatus: 'supported_file_export',
			targetId: 'test',
			title: 'Test',
		};
		expect(result.readOnly).toBe(true);
	});
});
