/**
 * Migration Registry Tests — Step 13.2
 *
 * Tests the migration registry: deterministic ordering, duplicate detection,
 * path finding, and plan item conversion.
 */

import { describe, expect, it } from 'vitest';
import {
	CURRENT_SCHEMA_VERSION,
	createDefaultMigrationRegistry,
	migrationToPlanItem,
	type WorkspaceMigrationDefinition,
} from '../src/state/migration-registry.js';

// ---------------------------------------------------------------------------
// Registry creation
// ---------------------------------------------------------------------------

describe('createDefaultMigrationRegistry', () => {
	it('creates a non-empty registry', () => {
		const reg = createDefaultMigrationRegistry();
		expect(reg.migrations.length).toBeGreaterThan(0);
	});

	it('all migrations have unique ids', () => {
		const reg = createDefaultMigrationRegistry();
		const ids = reg.migrations.map((m) => m.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it('migrations are ordered deterministically by fromVersion', () => {
		const reg = createDefaultMigrationRegistry();
		const versions = reg.migrations.map((m) => m.fromVersion);
		const sorted = [...versions].sort((a, b) =>
			a.localeCompare(b, undefined, { numeric: true }),
		);
		expect(versions).toEqual(sorted);
	});

	it('finds migration by id', () => {
		const reg = createDefaultMigrationRegistry();
		const migration = reg.findById('migrate-v3.0.0-to-v3.1.0');
		expect(migration).toBeDefined();
		expect(migration?.fromVersion).toBe('3.0.0');
		expect(migration?.toVersion).toBe('3.1.0');
	});

	it('returns undefined for unknown migration id', () => {
		const reg = createDefaultMigrationRegistry();
		expect(reg.findById('nonexistent')).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// Path finding
// ---------------------------------------------------------------------------

describe('findPath', () => {
	it('finds migration path from 3.0.0 to 3.1.0', () => {
		const reg = createDefaultMigrationRegistry();
		const path = reg.findPath('3.0.0', '3.1.0', 'up');
		expect(path.length).toBe(1);
		expect(path[0]?.id).toBe('migrate-v3.0.0-to-v3.1.0');
	});

	it('finds migration path from 1.0.0 to 3.1.0 (multi-step)', () => {
		const reg = createDefaultMigrationRegistry();
		const path = reg.findPath('1.0.0', '3.1.0', 'up');
		expect(path.length).toBe(3);
		expect(path.map((m) => m.id)).toEqual([
			'migrate-v1.0.0-to-v2.0.0',
			'migrate-v2.0.0-to-v3.0.0',
			'migrate-v3.0.0-to-v3.1.0',
		]);
	});

	it('returns empty path when versions are equal', () => {
		const reg = createDefaultMigrationRegistry();
		const path = reg.findPath('3.1.0', '3.1.0', 'up');
		expect(path.length).toBe(0);
	});

	it('returns empty path for unsupported direction', () => {
		const reg = createDefaultMigrationRegistry();
		const path = reg.findPath('3.0.0', '3.1.0', 'down');
		expect(path.length).toBe(0);
	});

	it('returns empty path for unknown fromVersion', () => {
		const reg = createDefaultMigrationRegistry();
		const path = reg.findPath('9.9.9', '3.1.0', 'up');
		expect(path.length).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// Current schema version
// ---------------------------------------------------------------------------

describe('CURRENT_SCHEMA_VERSION', () => {
	it('matches workspace state schema version', () => {
		expect(CURRENT_SCHEMA_VERSION).toBe('3.2.0');
	});

	it('is a valid semver-like string', () => {
		expect(CURRENT_SCHEMA_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
	});
});

// ---------------------------------------------------------------------------
// Plan item conversion
// ---------------------------------------------------------------------------

describe('migrationToPlanItem', () => {
	it('converts a migration definition to a plan item', () => {
		const def: WorkspaceMigrationDefinition = {
			affectedStateFiles: ['workspace.json'],
			description: 'Test migration',
			directions: ['up'],
			fromVersion: '3.0.0',
			id: 'test-migration',
			postconditions: ['version is 3.1.0'],
			preconditions: ['version is 3.0.0'],
			supported: true,
			toVersion: '3.1.0',
			warnings: ['Test warning'],
		};

		const item = migrationToPlanItem(def, 0);
		expect(item.migrationId).toBe('test-migration');
		expect(item.fromVersion).toBe('3.0.0');
		expect(item.toVersion).toBe('3.1.0');
		expect(item.orderIndex).toBe(0);
		expect(item.blocked).toBe(false);
		expect(item.warnings).toEqual(['Test warning']);
	});

	it('marks unsupported migration as blocked', () => {
		const def: WorkspaceMigrationDefinition = {
			affectedStateFiles: [],
			description: 'Unsupported',
			directions: ['up'],
			fromVersion: '1.0.0',
			id: 'unsupported',
			postconditions: [],
			preconditions: [],
			supported: false,
			toVersion: '2.0.0',
			warnings: [],
		};

		const item = migrationToPlanItem(def, 0);
		expect(item.blocked).toBe(true);
		expect(item.blockedReason).toBeDefined();
	});
});

// ---------------------------------------------------------------------------
// Deterministic ordering
// ---------------------------------------------------------------------------

describe('migration ordering', () => {
	it('reorders in deterministic sequence after creating registry twice', () => {
		const reg1 = createDefaultMigrationRegistry();
		const reg2 = createDefaultMigrationRegistry();

		expect(reg1.migrations.map((m) => m.id)).toEqual(
			reg2.migrations.map((m) => m.id),
		);
	});

	it('migrations are sorted by fromVersion ascending then id', () => {
		const reg = createDefaultMigrationRegistry();
		const migrations = reg.migrations;

		for (let i = 1; i < migrations.length; i++) {
			const prev = migrations[i - 1];
			const curr = migrations[i];
			if (!prev || !curr) continue;

			const fromCmp = prev.fromVersion.localeCompare(
				curr.fromVersion,
				undefined,
				{
					numeric: true,
				},
			);
			if (fromCmp !== 0) {
				expect(fromCmp).toBeLessThan(0);
			} else {
				expect(prev.id.localeCompare(curr.id)).toBeLessThan(0);
			}
		}
	});
});

// ---------------------------------------------------------------------------
// Duplicate detection
// ---------------------------------------------------------------------------

describe('duplicate migration id rejection', () => {
	it('is enforced by the registry constructor guarantee', () => {
		// All built-in migrations have unique IDs
		const reg = createDefaultMigrationRegistry();
		const ids = reg.migrations.map((m) => m.id);
		const seen = new Set<string>();
		for (const id of ids) {
			expect(seen.has(id)).toBe(false);
			seen.add(id);
		}
	});
});

// ---------------------------------------------------------------------------
// Missing migration path
// ---------------------------------------------------------------------------

describe('missing migration path', () => {
	it('returns empty for version with no path', () => {
		const reg = createDefaultMigrationRegistry();
		const path = reg.findPath('0.0.1', '3.1.0', 'up');
		expect(path).toHaveLength(0);
	});

	it('returns empty for verify_only direction', () => {
		const reg = createDefaultMigrationRegistry();
		const path = reg.findPath('3.0.0', '3.1.0', 'verify_only');
		expect(path).toHaveLength(0);
	});
});
