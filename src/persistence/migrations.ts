/**
 * Schema migration engine — applies versioned transformations to
 * persisted session data.
 *
 * Migrations are explicit, typed, and validated. Every migration must
 * preserve node conversations and accepted canonical answers. The
 * migration engine runs before session resume and is responsible for
 * adapting snapshots from older schema versions to the current version.
 *
 * @see {@link https://logos-engine/docs/09-session-events-and-persistence.md §11}
 * @see {@link https://logos-engine/docs/architecture/04-data-and-persistence-architecture.md §12}
 */

import type { LogosRuntimeState } from '../contracts/index.js';
import type { Migration } from '../contracts/persistence.js';
import { err, ok, type Result } from '../shared/index.js';
import { CURRENT_SCHEMA_VERSION } from './snapshot-store.js';

// Re-export the Migration type so consumers don’t need to import contracts directly.
export type { Migration };

// ═══════════════════════════════════════════════════════════════════════════
// Migration error type
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Structured error returned by the migration engine.
 */
export type MigrationError = {
	/** Machine-readable error code. */
	readonly code: string;
	/** Human-readable description. */
	readonly message: string;
	/** The schema version that triggered the error. */
	readonly fromVersion: string;
	/** The target schema version. */
	readonly toVersion: string;
};

function migrationErr(
	code: string,
	message: string,
	fromVersion: string,
	toVersion: string,
): MigrationError {
	return { code, fromVersion, message, toVersion };
}

// ═══════════════════════════════════════════════════════════════════════════
// Default migrations
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Default migration list.
 *
 * Currently empty — the first schema version (1.0.0) is the baseline.
 * Add new migrations here as the schema evolves. Migrations are applied
 * in order; each one transforms data from `from` to `to`.
 *
 * Example future migration:
 * ```
 * {
 *   from: '1.0.0',
 *   to:   '1.1.0',
 *   migrate: (data: unknown): unknown => {
 *     // Transform data, preserving conversations and accepted answers.
 *     return data;
 *   },
 * },
 * ```
 */
export const DEFAULT_MIGRATIONS: Migration[] = [];

// ═══════════════════════════════════════════════════════════════════════════
// Conversation / canonical answer preservation
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Extract per-node preservation signatures from a runtime state.
 *
 * Each signature captures the identity and content of conversation
 * messages and accepted canonical answers. After a migration, every
 * pre-migration signature must still be present — otherwise the
 * migration silently dropped or altered data.
 *
 * @returns A `Set` of stringified signatures for comparison.
 */
function extractPreservationSignatures(state: unknown): Set<string> {
	const sigs = new Set<string>();

	if (typeof state !== 'object' || state === null) return sigs;

	const s = state as Record<string, unknown>;
	const nodeStates = s.nodeStates;

	if (typeof nodeStates !== 'object' || nodeStates === null) return sigs;

	for (const key of Object.keys(nodeStates)) {
		const ns = (nodeStates as Record<string, unknown>)[key];
		if (typeof ns !== 'object' || ns === null) continue;

		// ── Conversation message signatures ─────────────────────────
		const conv = (ns as Record<string, unknown>).conversation;
		if (Array.isArray(conv)) {
			for (const msg of conv) {
				if (typeof msg !== 'object' || msg === null) continue;
				const m = msg as Record<string, unknown>;
				sigs.add(
					`msg:${key}:${String(m.id ?? '?')}:${String(m.role ?? '?')}:${String(m.content ?? '?')}:${String(m.createdAt ?? '?')}`,
				);
			}
		}

		// ── Accepted canonical answer signatures ────────────────────
		const ca = (ns as Record<string, unknown>).canonicalAnswer;
		if (
			typeof ca === 'object' &&
			ca !== null &&
			(ca as Record<string, unknown>).accepted === true
		) {
			const a = ca as Record<string, unknown>;
			sigs.add(
				`ca:${key}:${String(a.content ?? '?')}:` +
					`gmids=${JSON.stringify(a.generatedFromMessageIds ?? [])}:` +
					`conf=${String(a.confidence ?? '?')}`,
			);
		}
	}

	return sigs;
}

// ═══════════════════════════════════════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Run schema migrations on a runtime state object.
 *
 * @param data - The deserialized runtime state to migrate.
 * @param fromVersion - The schema version the data is currently at.
 * @param toVersion - The target schema version. Defaults to `CURRENT_SCHEMA_VERSION`.
 * @param migrations - Available migrations. Defaults to `DEFAULT_MIGRATIONS`.
 * @returns The migrated runtime state, or a `MigrationError`.
 *
 * Guarantees:
 * - Node conversations are preserved (message count is verified).
 * - Accepted canonical answers are preserved.
 * - If a migration path is unavailable, an error is returned — data is
 *   never silently coerced.
 * - If the version is newer than the target, an error is returned
 *   (downgrade is not supported).
 */
export function runMigrations(
	data: LogosRuntimeState,
	fromVersion: string,
	toVersion: string = CURRENT_SCHEMA_VERSION,
	migrations: ReadonlyArray<Migration> = DEFAULT_MIGRATIONS,
): Result<LogosRuntimeState, MigrationError> {
	// ── Identity: no migration needed ─────────────────────────────────
	if (fromVersion === toVersion) {
		return ok(data);
	}

	// ── Downgrade protection ──────────────────────────────────────────
	// If the data was written by a newer version than we support,
	// refuse to load — we cannot safely downgrade.
	if (fromVersion > toVersion) {
		return err(
			migrationErr(
				'MIGRATION_NEWER_VERSION',
				`Snapshot schema version "${fromVersion}" is newer than the current version "${toVersion}". Downgrade is not supported.`,
				fromVersion,
				toVersion,
			),
		);
	}

	// ── Build migration path ──────────────────────────────────────────
	// Find the chain of migrations from fromVersion to toVersion.
	const ordered: Migration[] = [];
	let currentVersion = fromVersion;

	// Breadth-first search through migrations to find the path.
	// Since migrations are a chain, we iterate linearly.
	// We try to step forward one version at a time.
	const maxSteps = migrations.length + 1;
	for (let step = 0; step < maxSteps; step++) {
		const nextMigration = migrations.find((m) => m.from === currentVersion);
		if (nextMigration === undefined) break;
		ordered.push(nextMigration);
		currentVersion = nextMigration.to;
		if (currentVersion === toVersion) break;
	}

	if (currentVersion !== toVersion) {
		return err(
			migrationErr(
				'MIGRATION_PATH_NOT_FOUND',
				`No migration path from schema version "${fromVersion}" to "${toVersion}". ` +
					'Verify that all intermediate migrations are registered.',
				fromVersion,
				toVersion,
			),
		);
	}

	// ── Apply migrations ──────────────────────────────────────────────
	let migrated: unknown = data;
	const beforeSignatures = extractPreservationSignatures(data);

	for (const migration of ordered) {
		try {
			migrated = migration.migrate(migrated);
		} catch (cause: unknown) {
			return err(
				migrationErr(
					'MIGRATION_EXECUTION_FAILED',
					`Migration from "${migration.from}" to "${migration.to}" threw: ${String(cause)}`,
					migration.from,
					migration.to,
				),
			);
		}

		// Verify preservation after this migration step.
		// We check after each step to pinpoint which migration was destructive.
		if (typeof migrated === 'object' && migrated !== null) {
			const afterSignatures = extractPreservationSignatures(migrated);

			// Every pre-migration signature must still exist in the post-migration set.
			const lostSignatures: string[] = [];
			for (const sig of beforeSignatures) {
				if (!afterSignatures.has(sig)) {
					lostSignatures.push(sig);
				}
			}

			if (lostSignatures.length > 0) {
				return err(
					migrationErr(
						'MIGRATION_DATA_LOSS',
						`Migration from "${migration.from}" to "${migration.to}" dropped or altered ` +
							`${lostSignatures.length} conversation messages or accepted canonical answers. ` +
							`Lost signatures (first 3): ${lostSignatures.slice(0, 3).join(' | ')}`,
						migration.from,
						migration.to,
					),
				);
			}
		}
	}

	return ok(migrated as LogosRuntimeState);
}
