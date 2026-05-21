/**
 * Migration Registry — deterministic, ordered migration definitions for .logos/ workspace state.
 *
 * Step 13.2 — Implement Migrations, Backups, and Performance Baseline
 *
 * Each migration is a pure, side-effect-free function pair (plan + apply). No migration may:
 * - Call AI, network, external APIs, package scripts, or external tools
 * - Modify canonical Markdown or generated artifacts
 * - Assume provider credentials or network access
 */

import path from 'node:path';
import type {
	WorkspaceMigrationDirection,
	WorkspaceMigrationId,
	WorkspaceMigrationPlanItem,
	WorkspaceSchemaVersion,
} from './migration-model.js';
import { WORKSPACE_STATE_SCHEMA_VERSION } from './workspace-state.schema.js';

// ---------------------------------------------------------------------------
// Migration Definition
// ---------------------------------------------------------------------------

export interface WorkspaceMigrationDefinition {
	/** Unique migration id */
	id: WorkspaceMigrationId;
	/** Source schema version */
	fromVersion: WorkspaceSchemaVersion;
	/** Target schema version */
	toVersion: WorkspaceSchemaVersion;
	/** Human-readable description */
	description: string;
	/** Supported directions */
	directions: WorkspaceMigrationDirection[];
	/** State files affected by this migration (relative to .logos/) */
	affectedStateFiles: string[];
	/** Preconditions */
	preconditions: string[];
	/** Postconditions */
	postconditions: string[];
	/** Warnings */
	warnings: string[];
	/** Whether this migration is currently supported */
	supported: boolean;
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export interface WorkspaceMigrationRegistry {
	/** All registered migrations, sorted by order index */
	migrations: WorkspaceMigrationDefinition[];
	/** Find a migration by id */
	findById(id: WorkspaceMigrationId): WorkspaceMigrationDefinition | undefined;
	/** Find the migration path from one version to another */
	findPath(
		from: WorkspaceSchemaVersion,
		to: WorkspaceSchemaVersion,
		direction: WorkspaceMigrationDirection,
	): WorkspaceMigrationDefinition[];
}

// ---------------------------------------------------------------------------
// Built-in Migrations
// ---------------------------------------------------------------------------

/**
 * Migration: 3.0.0 → 3.1.0
 *
 * Adds migration records array, run records, updated schema.
 * This is the baseline migration for pre-existing state that lacks the
 * current schema structure.
 */
const MIGRATION_3_0_0_TO_3_1_0: WorkspaceMigrationDefinition = {
	affectedStateFiles: ['workspace.json'],
	description:
		'Upgrade workspace state from 3.0.0 to 3.1.0: add migration records and run record schema.',
	directions: ['up'],
	fromVersion: '3.0.0',
	id: 'migrate-v3.0.0-to-v3.1.0',
	postconditions: [
		'schemaVersion is 3.1.0',
		'migrations array exists',
		'runs array schema is compatible',
	],
	preconditions: [
		'workspace.json exists and is valid JSON',
		'schemaVersion is 3.0.0',
	],
	supported: true,
	toVersion: '3.1.0',
	warnings: [
		'Ensure no manual edits were made to workspace.json between versions.',
	],
};

/**
 * Migration: 3.1.0 → 3.2.0
 *
 * Adds intakeTurns array, expands proposal schema with new fields.
 */
const MIGRATION_3_1_0_TO_3_2_0: WorkspaceMigrationDefinition = {
	affectedStateFiles: ['workspace.json'],
	description:
		'Upgrade workspace state from 3.1.0 to 3.2.0: add intake turns, expand proposal schema.',
	directions: ['up'],
	fromVersion: '3.1.0',
	id: 'migrate-v3.1.0-to-v3.2.0',
	postconditions: [
		'schemaVersion is 3.2.0',
		'intakeTurns array exists',
		'proposal schema includes new fields',
	],
	preconditions: [
		'workspace.json exists and is valid JSON',
		'schemaVersion is 3.1.0',
	],
	supported: true,
	toVersion: '3.2.0',
	warnings: ['New proposal fields default to empty values; review if needed.'],
};

/**
 * Migration: 2.0.0 → 3.0.0
 *
 * Legacy migration path for very old workspaces.
 */
const MIGRATION_2_0_0_TO_3_0_0: WorkspaceMigrationDefinition = {
	affectedStateFiles: ['workspace.json'],
	description:
		'Upgrade workspace state from 2.0.0 to 3.0.0: restructure to current state model.',
	directions: ['up'],
	fromVersion: '2.0.0',
	id: 'migrate-v2.0.0-to-v3.0.0',
	postconditions: [
		'schemaVersion is 3.0.0',
		'state schema is compatible with v3.0.0',
	],
	preconditions: [
		'workspace.json exists and is valid JSON',
		'schemaVersion is 2.0.0',
	],
	supported: true,
	toVersion: '3.0.0',
	warnings: ['Legacy 2.0.0 workspaces may contain deprecated fields.'],
};

/**
 * Migration: 1.0.0 → 2.0.0
 *
 * Legacy migration path for very old workspaces.
 */
const MIGRATION_1_0_0_TO_2_0_0: WorkspaceMigrationDefinition = {
	affectedStateFiles: ['workspace.json'],
	description: 'Upgrade workspace state from 1.0.0 to 2.0.0.',
	directions: ['up'],
	fromVersion: '1.0.0',
	id: 'migrate-v1.0.0-to-v2.0.0',
	postconditions: ['schemaVersion is 2.0.0'],
	preconditions: [
		'workspace.json exists and is valid JSON',
		'schemaVersion is 1.0.0',
	],
	supported: true,
	toVersion: '2.0.0',
	warnings: [],
};

// ---------------------------------------------------------------------------
// Built-in Registry
// ---------------------------------------------------------------------------

const BUILTIN_MIGRATIONS: WorkspaceMigrationDefinition[] = [
	MIGRATION_1_0_0_TO_2_0_0,
	MIGRATION_2_0_0_TO_3_0_0,
	MIGRATION_3_0_0_TO_3_1_0,
	MIGRATION_3_1_0_TO_3_2_0,
];

function sortMigrations(
	migrations: WorkspaceMigrationDefinition[],
): WorkspaceMigrationDefinition[] {
	return [...migrations].sort((a, b) => {
		// Sort by fromVersion ascending
		const fromCmp = a.fromVersion.localeCompare(b.fromVersion, undefined, {
			numeric: true,
		});
		if (fromCmp !== 0) return fromCmp;
		// Then by id
		return a.id.localeCompare(b.id);
	});
}

function createMigrationRegistry(
	migrations: WorkspaceMigrationDefinition[],
): WorkspaceMigrationRegistry {
	const sorted = sortMigrations(migrations);

	// Detect duplicate ids
	const ids = new Set<string>();
	for (const m of sorted) {
		if (ids.has(m.id)) {
			throw new Error(
				`Duplicate migration id "${m.id}" in registry. Migration ids must be unique.`,
			);
		}
		ids.add(m.id);
	}

	return {
		findById(
			id: WorkspaceMigrationId,
		): WorkspaceMigrationDefinition | undefined {
			return sorted.find((m) => m.id === id);
		},
		findPath(
			from: WorkspaceSchemaVersion,
			to: WorkspaceSchemaVersion,
			direction: WorkspaceMigrationDirection,
		): WorkspaceMigrationDefinition[] {
			if (direction !== 'up') {
				return []; // Down migrations not currently supported
			}

			// Simple linear path: find migrations with fromVersion >= 'from' and toVersion <= 'to'
			const path: WorkspaceMigrationDefinition[] = [];
			const visited = new Set<WorkspaceSchemaVersion>();

			// For 'up' direction, build a linear path
			let current = from;

			while (current !== to) {
				const next = sorted.find(
					(m) => m.fromVersion === current && m.supported,
				);
				if (!next) break;

				if (visited.has(current)) break; // Cycle detection
				visited.add(current);

				path.push(next);
				current = next.toVersion;
			}

			// Filter by direction
			return path.filter((m) => m.directions.includes(direction));
		},
		migrations: sorted,
	};
}

/**
 * Create the default migration registry with built-in migrations.
 */
export function createDefaultMigrationRegistry(): WorkspaceMigrationRegistry {
	return createMigrationRegistry(BUILTIN_MIGRATIONS);
}

/**
 * Build a plan item from a migration definition.
 */
export function migrationToPlanItem(
	migration: WorkspaceMigrationDefinition,
	orderIndex: number,
): WorkspaceMigrationPlanItem {
	return {
		affectedStateFiles: migration.affectedStateFiles,
		blocked: !migration.supported,
		blockedReason: migration.supported
			? undefined
			: 'Migration is not supported in this version.',
		description: migration.description,
		expectedChangedPaths: migration.affectedStateFiles.map((f) =>
			path.join('.logos', f),
		),
		fromVersion: migration.fromVersion,
		migrationId: migration.id,
		orderIndex,
		postconditions: migration.postconditions,
		preconditions: migration.preconditions,
		toVersion: migration.toVersion,
		warnings: migration.warnings,
	};
}

/** Current schema version for migration target */
export const CURRENT_SCHEMA_VERSION = WORKSPACE_STATE_SCHEMA_VERSION;
