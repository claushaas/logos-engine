/**
 * Migration Model Tests — Step 13.2
 *
 * Tests the migration model types, status ordering, schema version detection,
 * and comparison functions.
 */

import { describe, expect, it } from 'vitest';
import {
	BACKUP_STATUS_ORDER,
	buildBackupId,
	compareSchemaVersions,
	detectSchemaVersion,
	MIGRATION_DIRECTION_ORDER,
	MIGRATION_STATUS_ORDER,
	type SchemaVersionDetection,
	type WorkspaceBackupStatus,
	type WorkspaceMigrationDirection,
	type WorkspaceMigrationStatus,
} from '../src/state/migration-model.js';

// ---------------------------------------------------------------------------
// Schema Version Detection
// ---------------------------------------------------------------------------

describe('detectSchemaVersion', () => {
	const CURRENT = '3.2.0';

	it('detects current schema version', () => {
		const result = detectSchemaVersion({ schemaVersion: '3.2.0' }, CURRENT);
		expect(result.detection).toBe('current');
		expect(result.detectedVersion).toBe('3.2.0');
	});

	it('detects older schema version', () => {
		const result = detectSchemaVersion({ schemaVersion: '3.0.0' }, CURRENT);
		expect(result.detection).toBe('older');
		expect(result.detectedVersion).toBe('3.0.0');
	});

	it('detects future schema version', () => {
		const result = detectSchemaVersion({ schemaVersion: '4.0.0' }, CURRENT);
		expect(result.detection).toBe('future');
	});

	it('detects missing schema version as legacy/unknown', () => {
		const result = detectSchemaVersion({}, CURRENT);
		expect(result.detection).toBe('missing');
		expect(result.detectedVersion).toBeUndefined();
	});

	it('detects null state as missing', () => {
		const result = detectSchemaVersion(null, CURRENT);
		expect(result.detection).toBe('missing');
	});

	it('detects undefined state as missing', () => {
		const result = detectSchemaVersion(undefined, CURRENT);
		expect(result.detection).toBe('missing');
	});

	it('detects non-object state as corrupt', () => {
		const result = detectSchemaVersion('not-an-object', CURRENT);
		expect(result.detection).toBe('corrupt');
	});

	it('detects non-string schemaVersion as corrupt', () => {
		const result = detectSchemaVersion({ schemaVersion: 123 }, CURRENT);
		expect(result.detection).toBe('corrupt');
	});

	it('detects very old version', () => {
		const result = detectSchemaVersion({ schemaVersion: '1.0.0' }, CURRENT);
		expect(result.detection).toBe('older');
		expect(result.detectedVersion).toBe('1.0.0');
	});
});

// ---------------------------------------------------------------------------
// Version Comparison
// ---------------------------------------------------------------------------

describe('compareSchemaVersions', () => {
	it('returns 0 for equal versions', () => {
		expect(compareSchemaVersions('3.2.0', '3.2.0')).toBe(0);
		expect(compareSchemaVersions('1.0.0', '1.0.0')).toBe(0);
	});

	it('returns negative when a < b', () => {
		expect(compareSchemaVersions('3.1.0', '3.2.0')).toBeLessThan(0);
		expect(compareSchemaVersions('2.9.9', '3.0.0')).toBeLessThan(0);
		expect(compareSchemaVersions('1.0.0', '3.2.0')).toBeLessThan(0);
	});

	it('returns positive when a > b', () => {
		expect(compareSchemaVersions('5.0.0', '3.2.0')).toBeGreaterThan(0);
		expect(compareSchemaVersions('4.0.0', '3.2.0')).toBeGreaterThan(0);
	});

	it('handles patch version differences', () => {
		expect(compareSchemaVersions('3.2.1', '3.2.0')).toBeGreaterThan(0);
		expect(compareSchemaVersions('3.2.0', '3.2.1')).toBeLessThan(0);
	});

	it('handles non-standard version strings gracefully', () => {
		expect(compareSchemaVersions('1', '2.0.0')).toBeLessThan(0);
		expect(compareSchemaVersions('2', '1.0.0')).toBeGreaterThan(0);
		expect(compareSchemaVersions('abc', '1.0.0')).toBeLessThan(0);
	});
});

// ---------------------------------------------------------------------------
// Migration Status Ordering
// ---------------------------------------------------------------------------

describe('migration statuses', () => {
	it('all required statuses are defined', () => {
		const statuses: WorkspaceMigrationStatus[] = [
			'not_needed',
			'planned',
			'applied',
			'blocked',
			'failed',
			'partial',
			'dry_run',
			'unknown',
		];
		for (const s of statuses) {
			expect(MIGRATION_STATUS_ORDER[s]).toBeDefined();
		}
	});

	it('all order values are unique', () => {
		const values = Object.values(MIGRATION_STATUS_ORDER);
		expect(new Set(values).size).toBe(values.length);
	});
});

// ---------------------------------------------------------------------------
// Backup Status Ordering
// ---------------------------------------------------------------------------

describe('backup statuses', () => {
	it('all required statuses are defined', () => {
		const statuses: WorkspaceBackupStatus[] = [
			'created',
			'verified',
			'restored',
			'skipped',
			'blocked',
			'failed',
			'partial',
			'dry_run',
		];
		for (const s of statuses) {
			expect(BACKUP_STATUS_ORDER[s]).toBeDefined();
		}
	});

	it('all order values are unique', () => {
		const values = Object.values(BACKUP_STATUS_ORDER);
		expect(new Set(values).size).toBe(values.length);
	});
});

// ---------------------------------------------------------------------------
// Migration Direction Ordering
// ---------------------------------------------------------------------------

describe('migration directions', () => {
	it('all required directions are defined', () => {
		const directions: WorkspaceMigrationDirection[] = [
			'up',
			'down',
			'verify_only',
		];
		for (const d of directions) {
			expect(MIGRATION_DIRECTION_ORDER[d]).toBeDefined();
		}
	});
});

// ---------------------------------------------------------------------------
// Build Backups ID
// ---------------------------------------------------------------------------

describe('buildBackupId', () => {
	it('generates deterministic backup IDs', () => {
		const id = buildBackupId('2024-01-01T00:00:00.000Z', 'test01');
		expect(id).toBe('backup-2024-01-01T00-00-00-test01');

		// Same inputs produce same output
		const id2 = buildBackupId('2024-01-01T00:00:00.000Z', 'test01');
		expect(id2).toBe(id);
	});

	it('does not contain raw colons in backup ID', () => {
		const id = buildBackupId('2024-01-01T12:30:45.678Z', 'abc123');
		expect(id).not.toContain(':');
		expect(id).toContain('2024-01-01T12-30-45');
	});
});

// ---------------------------------------------------------------------------
// Schema Version Detection Snapshot (for regression)
// ---------------------------------------------------------------------------

describe('schema version detection snapshot', () => {
	const CURRENT = '3.2.0';

	const testCases: Array<{
		input: unknown;
		expected: SchemaVersionDetection;
	}> = [
		{ expected: 'current', input: { schemaVersion: '3.2.0' } },
		{ expected: 'older', input: { schemaVersion: '3.0.0' } },
		{ expected: 'older', input: { schemaVersion: '2.0.0' } },
		{ expected: 'older', input: { schemaVersion: '1.0.0' } },
		{ expected: 'future', input: { schemaVersion: '4.0.0' } },
		{ expected: 'future', input: { schemaVersion: '5.0.0' } },
		{ expected: 'missing', input: {} },
		{ expected: 'missing', input: null },
		{ expected: 'missing', input: undefined },
		{ expected: 'corrupt', input: 'string' },
		{ expected: 'corrupt', input: 42 },
		{ expected: 'corrupt', input: { schemaVersion: 999 } },
	];

	for (const tc of testCases) {
		it(`detects "${
			tc.input === null
				? 'null'
				: tc.input === undefined
					? 'undefined'
					: typeof tc.input === 'object'
						? `schemaVersion=${(tc.input as Record<string, unknown>).schemaVersion ?? 'none'}`
						: String(tc.input)
		}" as ${tc.expected}`, () => {
			const result = detectSchemaVersion(tc.input, CURRENT);
			expect(result.detection).toBe(tc.expected);
		});
	}
});
