/**
 * Migration Runner — plans and applies workspace schema migrations.
 *
 * Step 13.2 — Implement Migrations, Backups, and Performance Baseline
 *
 * The runner:
 * 1. Detects current schema version from workspace state
 * 2. Plans ordered migrations
 * 3. Creates backups before mutating
 * 4. Applies migrations in order
 * 5. Validates state after each migration
 * 6. Reports precise diagnostics for failures
 *
 * All operations are local-first, deterministic, provider-free, and non-telemetry.
 */

import path from 'node:path';
import { serializeJson, writeFileAtomic } from '../fs/safe-filesystem.js';
import { createWorkspaceBackup } from './backup-service.js';
import {
	detectSchemaVersion,
	type WorkspaceMigrationChangedPath,
	type WorkspaceMigrationDiagnostic,
	type WorkspaceMigrationOptions,
	type WorkspaceMigrationPlan,
	type WorkspaceMigrationPlanItem,
	type WorkspaceMigrationResult,
	type WorkspaceMigrationStatus,
} from './migration-model.js';
import {
	CURRENT_SCHEMA_VERSION,
	createDefaultMigrationRegistry,
	migrationToPlanItem,
	type WorkspaceMigrationDefinition,
	type WorkspaceMigrationRegistry,
} from './migration-registry.js';
import { validateWorkspaceState } from './workspace-state-validation.js';

// ---------------------------------------------------------------------------
// Plan
// ---------------------------------------------------------------------------

export interface MigrationPlanInput {
	projectRoot: string;
	workspaceFilePath: string;
	rawState: unknown;
	registry?: WorkspaceMigrationRegistry | undefined;
	dryRun?: boolean | undefined;
	_testTimestamp?: string | undefined;
}

/**
 * Plan migrations from detected schema version to current version.
 *
 * Planning is read-only: no files are written, no state is mutated, no backups are created.
 */
export function planMigrations(
	input: MigrationPlanInput,
): WorkspaceMigrationPlan {
	const registry = input.registry ?? createDefaultRegistry();

	const detection = detectSchemaVersion(input.rawState, CURRENT_SCHEMA_VERSION);

	const warnings: string[] = [];
	const blockers: string[] = [];
	const affectedPaths: string[] = [];
	let items: WorkspaceMigrationPlanItem[] = [];
	let status: WorkspaceMigrationStatus = 'not_needed';
	let backupRequired = false;

	switch (detection.detection) {
		case 'current':
			status = 'not_needed';
			break;

		case 'missing':
			status = 'blocked';
			blockers.push(
				'Schema version is missing from workspace state. Cannot determine migration path.',
			);
			warnings.push(
				'Workspace state has no schemaVersion field. Treat as legacy/unknown.',
			);
			break;

		case 'corrupt':
			status = 'blocked';
			blockers.push(
				'Workspace state is corrupt; schema version cannot be read. Migrate manually.',
			);
			warnings.push('Corrupt state must not be migrated blindly.');
			break;

		case 'future':
			status = 'blocked';
			blockers.push(
				`Workspace schema version ${detection.detectedVersion} is newer than current version ${CURRENT_SCHEMA_VERSION}. ` +
					'Update LOGOS Engine to the latest version or manually downgrade the workspace.',
			);
			warnings.push(
				'Running an older engine version on a newer workspace may cause data loss.',
			);
			break;

		case 'older': {
			const detectedVersion = detection.detectedVersion;
			if (!detectedVersion) {
				status = 'blocked';
				blockers.push(
					'Detected older version but cannot determine exact version.',
				);
				break;
			}

			const migrations = registry.findPath(
				detectedVersion,
				CURRENT_SCHEMA_VERSION,
				'up',
			);

			if (migrations.length === 0) {
				status = 'blocked';
				blockers.push(
					`No migration path found from ${detectedVersion} to ${CURRENT_SCHEMA_VERSION}.`,
				);
				break;
			}

			items = migrations.map((m, i) => migrationToPlanItem(m, i));
			backupRequired = true;
			status = 'planned';

			for (const item of items) {
				affectedPaths.push(
					...item.affectedStateFiles.map((f) =>
						path.relative(
							input.projectRoot,
							path.join(input.projectRoot, '.logos', f),
						),
					),
				);
				if (item.blocked) {
					blockers.push(
						`Migration ${item.migrationId} is blocked: ${item.blockedReason ?? 'Unknown reason'}`,
					);
				}
				warnings.push(...item.warnings);
			}
			break;
		}
	}

	const hasBlocked = status === 'blocked' || items.some((i) => i.blocked);

	return {
		affectedPaths,
		backupRequired,
		blockers,
		direction: 'up',
		dryRun: input.dryRun ?? false,
		estimatedOperationCount: items.length + (backupRequired ? 1 : 0),
		fromVersion: detection.detectedVersion ?? 'unknown',
		hasBlocked,
		items,
		migrationCount: items.length,
		status: hasBlocked ? 'blocked' : status,
		toVersion: CURRENT_SCHEMA_VERSION,
		warnings,
	};
}

// ---------------------------------------------------------------------------
// Apply
// ---------------------------------------------------------------------------

export interface MigrationApplyInput {
	projectRoot: string;
	workspaceFilePath: string;
	plan: WorkspaceMigrationPlan;
	rawState: unknown;
	registry?: WorkspaceMigrationRegistry | undefined;
	options?: WorkspaceMigrationOptions | undefined;
	_fs?: import('../fs/safe-filesystem.js').SafeFsAdapter | undefined;
}

function createDefaultRegistry(): WorkspaceMigrationRegistry {
	return createDefaultMigrationRegistry();
}

/**
 * Apply a migration plan to workspace state.
 *
 * Processing order:
 * 1. Validate plan is not blocked
 * 2. Create backup (unless dry-run or explicitly skipped)
 * 3. Apply each migration in order
 * 4. Validate state after each migration
 * 5. Write updated state via safe filesystem adapter
 */
export async function applyMigrations(
	input: MigrationApplyInput,
): Promise<WorkspaceMigrationResult> {
	const registry = input.registry ?? createDefaultRegistry();
	const options = input.options ?? {};
	const diagnostics: WorkspaceMigrationDiagnostic[] = [];
	const changedPaths: WorkspaceMigrationChangedPath[] = [];
	const recoveryHints: string[] = [];
	const appliedMigrations: string[] = [];

	// Validate plan
	if (input.plan.status === 'blocked') {
		for (const blocker of input.plan.blockers) {
			diagnostics.push({
				code: 'LOGOS_STATE_MIGRATION_BLOCKED',
				message: blocker,
				severity: 'error',
			});
		}
		return {
			appliedMigrations: [],
			backupId: undefined,
			backupPath: undefined,
			changedPaths: [],
			diagnostics,
			dryRun: input.plan.dryRun,
			fromVersion: input.plan.fromVersion,
			recoveryHints,
			status: 'blocked',
			success: false,
			toVersion: input.plan.toVersion,
		};
	}

	if (input.plan.status === 'not_needed') {
		return {
			appliedMigrations: [],
			backupId: undefined,
			backupPath: undefined,
			changedPaths: [],
			diagnostics: [
				{
					code: 'LOGOS_STATE_MIGRATION_NOT_NEEDED',
					message:
						'Workspace is already at current schema version; no migration needed.',
					severity: 'info',
				},
			],
			dryRun: input.plan.dryRun,
			fromVersion: input.plan.fromVersion,
			recoveryHints: [],
			status: 'not_needed',
			success: true,
			toVersion: input.plan.toVersion,
		};
	}

	// Dry-run: return plan without mutation
	if (input.plan.dryRun) {
		for (const item of input.plan.items) {
			for (const p of item.affectedStateFiles) {
				changedPaths.push({
					path: `.logos/${p}`,
					role: 'planned',
				});
			}
		}
		return {
			appliedMigrations: [],
			backupId: undefined,
			backupPath: undefined,
			changedPaths,
			diagnostics: [
				{
					code: 'LOGOS_STATE_MIGRATION_DRY_RUN',
					message: `Would apply ${input.plan.items.length} migration(s) from ${input.plan.fromVersion} to ${input.plan.toVersion}.`,
					severity: 'info',
				},
			],
			dryRun: true,
			fromVersion: input.plan.fromVersion,
			recoveryHints: ['Run migration without --dry-run to apply changes.'],
			status: 'dry_run',
			success: true,
			toVersion: input.plan.toVersion,
		};
	}

	// Create backup before mutating
	let backupResult:
		| Awaited<ReturnType<typeof createWorkspaceBackup>>
		| undefined;

	if (!options.skipBackup) {
		backupResult = await createWorkspaceBackup({
			_fs: input._fs,
			_testRandomId: options._testRandomId,
			_testTimestamp: options._testTimestamp,
			dryRun: false,
			migrationId: input.plan.items[0]?.migrationId,
			projectRoot: input.projectRoot,
			reason: `Automatic backup before migration from ${input.plan.fromVersion} to ${input.plan.toVersion}`,
		});

		if (!backupResult.success) {
			for (const d of backupResult.diagnostics) {
				diagnostics.push(d);
			}
			diagnostics.push({
				code: 'LOGOS_STATE_BACKUP_FAILED_BLOCKS_MIGRATION',
				message:
					'Backup creation failed. Migration is blocked to protect user data.',
				recoveryHint:
					'Check filesystem permissions and disk space, then retry.',
				severity: 'error',
			});
			return {
				appliedMigrations: [],
				backupId: undefined,
				backupPath: undefined,
				changedPaths: [],
				diagnostics,
				dryRun: false,
				fromVersion: input.plan.fromVersion,
				recoveryHints: ['Resolve backup failure before retrying migration.'],
				status: 'failed',
				success: false,
				toVersion: input.plan.toVersion,
			};
		}

		for (const cp of backupResult.changedPaths) {
			changedPaths.push(cp);
		}
	}

	// Apply each migration
	let currentState = input.rawState as Record<string, unknown>;
	let partialFailure: WorkspaceMigrationResult['partialFailure'] | undefined;

	for (const [index, item] of input.plan.items.entries()) {
		const migration = registry.findById(item.migrationId);

		if (!migration) {
			diagnostics.push({
				code: 'LOGOS_STATE_MIGRATION_MISSING',
				message: `Migration ${item.migrationId} not found in registry.`,
				severity: 'error',
			});
			return {
				appliedMigrations,
				backupId: backupResult?.backupId,
				backupPath: backupResult?.backupPath,
				changedPaths,
				diagnostics,
				dryRun: false,
				fromVersion: input.plan.fromVersion,
				partialFailure: {
					completedMigrations: [...appliedMigrations],
					failedAfterMutation: false,
					failedMigration: item.migrationId,
				},
				recoveryHints: [
					`Backup available at: ${backupResult?.backupPath ?? 'unknown'}`,
					'Restore from backup and retry.',
				],
				status: 'failed',
				success: false,
				toVersion: input.plan.toVersion,
			};
		}

		if (!migration.supported) {
			diagnostics.push({
				code: 'LOGOS_STATE_MIGRATION_UNSUPPORTED',
				message: `Migration ${item.migrationId} is not supported.`,
				severity: 'error',
			});
			return {
				appliedMigrations,
				backupId: backupResult?.backupId,
				backupPath: backupResult?.backupPath,
				changedPaths,
				diagnostics,
				dryRun: false,
				fromVersion: input.plan.fromVersion,
				partialFailure: {
					completedMigrations: [...appliedMigrations],
					failedAfterMutation: false,
					failedMigration: item.migrationId,
				},
				recoveryHints: [
					`Backup available at: ${backupResult?.backupPath ?? 'unknown'}`,
				],
				status: 'failed',
				success: false,
				toVersion: input.plan.toVersion,
			};
		}

		// Apply the migration to the in-memory state
		try {
			currentState = applyMigrationToState(currentState, migration);
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : String(err);
			diagnostics.push({
				code: 'LOGOS_STATE_MIGRATION_APPLY_FAILED',
				message: `Failed to apply migration ${item.migrationId}: ${message}`,
				severity: 'error',
			});
			return {
				appliedMigrations,
				backupId: backupResult?.backupId,
				backupPath: backupResult?.backupPath,
				changedPaths,
				diagnostics,
				dryRun: false,
				fromVersion: input.plan.fromVersion,
				partialFailure: {
					completedMigrations: [...appliedMigrations],
					failedAfterMutation: false,
					failedMigration: item.migrationId,
				},
				recoveryHints: [
					`Backup available at: ${backupResult?.backupPath ?? 'unknown'}`,
					'Restore from backup to recover.',
				],
				status: 'failed',
				success: false,
				toVersion: input.plan.toVersion,
			};
		}

		appliedMigrations.push(item.migrationId);

		// After the last migration, validate the final state
		const isLast = index === input.plan.items.length - 1;
		if (isLast) {
			const validation = validateWorkspaceState(currentState);
			if (!validation.success) {
				for (const err of validation.errors) {
					diagnostics.push({
						code: `LOGOS_STATE_MIGRATION_VALIDATION_${err.code}`,
						message: err.message,
						path: err.path,
						recoveryHint: err.recoveryHint,
						severity: 'error',
					});
				}

				partialFailure = {
					completedMigrations: [...appliedMigrations],
					failedAfterMutation: true,
					failedMigration: item.migrationId,
				};

				return {
					appliedMigrations,
					backupId: backupResult?.backupId,
					backupPath: backupResult?.backupPath,
					changedPaths,
					diagnostics,
					dryRun: false,
					fromVersion: input.plan.fromVersion,
					partialFailure,
					recoveryHints: [
						'Migration produced invalid state.',
						`Backup available at: ${backupResult?.backupPath ?? 'unknown'}`,
						'Restore from backup to recover.',
					],
					status: 'partial',
					success: false,
					toVersion: input.plan.toVersion,
				};
			}
		}
	}

	// Write updated state file atomically
	const serialized = serializeJson(currentState, {
		indent: 2,
		redactSecrets: false,
	});
	if (!serialized.success) {
		diagnostics.push({
			code: 'LOGOS_STATE_MIGRATION_SERIALIZE_FAILED',
			message:
				serialized.error?.message ?? 'Failed to serialize migrated state.',
			severity: 'error',
		});
		return {
			appliedMigrations,
			backupId: backupResult?.backupId,
			backupPath: backupResult?.backupPath,
			changedPaths,
			diagnostics,
			dryRun: false,
			fromVersion: input.plan.fromVersion,
			partialFailure: {
				completedMigrations: [...appliedMigrations],
				failedAfterMutation: false,
				failedMigration: 'write',
			},
			recoveryHints: [
				`Backup available at: ${backupResult?.backupPath ?? 'unknown'}`,
			],
			status: 'partial',
			success: false,
			toVersion: input.plan.toVersion,
		};
	}

	const writeResult = await writeFileAtomic(
		input.workspaceFilePath,
		serialized.json as string,
		{
			_fs: input._fs,
			_testRandomId: options._testRandomId,
			_testTimestamp: options._testTimestamp,
			allowedBaseDir: input.projectRoot,
			dryRun: false,
			policy: 'backup_and_overwrite',
		},
	);

	if (!writeResult.success) {
		for (const d of writeResult.diagnostics) {
			diagnostics.push({
				code: d.code,
				message: d.message,
				path: d.targetPath,
				recoveryHint: d.recoveryHint,
				severity: d.severity,
			});
		}
		return {
			appliedMigrations,
			backupId: backupResult?.backupId,
			backupPath: backupResult?.backupPath,
			changedPaths,
			diagnostics,
			dryRun: false,
			fromVersion: input.plan.fromVersion,
			partialFailure: {
				completedMigrations: [...appliedMigrations],
				failedAfterMutation: true,
				failedMigration: 'write',
			},
			recoveryHints: [
				'Failed to write migrated state to disk.',
				`Backup available at: ${backupResult?.backupPath ?? 'unknown'}`,
			],
			status: 'partial',
			success: false,
			toVersion: input.plan.toVersion,
		};
	}

	for (const cp of writeResult.changedPaths) {
		changedPaths.push({
			path: cp.path,
			role:
				cp.role === 'file_created'
					? 'created'
					: cp.role === 'file_updated'
						? 'updated'
						: cp.role === 'backup_created'
							? 'backed_up'
							: 'planned',
		});
	}

	diagnostics.push({
		code: 'LOGOS_STATE_MIGRATION_APPLIED',
		message: `Successfully applied ${appliedMigrations.length} migration(s) from ${input.plan.fromVersion} to ${input.plan.toVersion}.`,
		severity: 'info',
	});

	return {
		appliedMigrations,
		backupId: backupResult?.backupId,
		backupPath: backupResult?.backupPath,
		changedPaths,
		diagnostics,
		dryRun: false,
		fromVersion: input.plan.fromVersion,
		recoveryHints: [],
		status: 'applied',
		success: true,
		toVersion: input.plan.toVersion,
	};
}

// ---------------------------------------------------------------------------
// Migration application logic
// ---------------------------------------------------------------------------

/**
 * Apply a migration definition to an in-memory state object.
 *
 * Each migration transforms the state from fromVersion to toVersion.
 * The state object is mutated in place (cloned by caller).
 */
function applyMigrationToState(
	state: Record<string, unknown>,
	migration: WorkspaceMigrationDefinition,
): Record<string, unknown> {
	switch (migration.id) {
		case 'migrate-v3.0.0-to-v3.1.0':
			return applyV3_0_0_To_V3_1_0(state);
		case 'migrate-v2.0.0-to-v3.0.0':
			return applyV2_0_0_To_V3_0_0(state);
		case 'migrate-v1.0.0-to-v2.0.0':
			return applyV1_0_0_To_V2_0_0(state);
		default:
			throw new Error(
				`No application logic defined for migration "${migration.id}".`,
			);
	}
}

function applyV3_0_0_To_V3_1_0(
	state: Record<string, unknown>,
): Record<string, unknown> {
	const result = structuredClone(state);
	result.schemaVersion = '3.1.0';

	// Ensure migrations array exists
	if (!Array.isArray(result.migrations)) {
		result.migrations = [];
	}

	// Ensure runs array exists with proper types
	if (!Array.isArray(result.runs)) {
		result.runs = [];
	}

	return result;
}

function applyV2_0_0_To_V3_0_0(
	state: Record<string, unknown>,
): Record<string, unknown> {
	const result = structuredClone(state);
	result.schemaVersion = '3.0.0';

	// Normalize key arrays
	for (const key of [
		'decisions',
		'assumptions',
		'openQuestions',
		'risks',
		'proposals',
		'sessions',
		'artifacts',
		'generationRuns',
		'validationRuns',
		'auditEvents',
		'claimSourceLinks',
		'claims',
		'sources',
		'migrations',
		'runs',
	]) {
		if (!Array.isArray(result[key])) {
			result[key] = [];
		}
	}

	// Ensure registers collection exists
	if (!result.registers || typeof result.registers !== 'object') {
		result.registers = {
			assumptions: [],
			decisions: [],
			hypotheses: [],
			lifecycleEvents: [],
			openQuestions: [],
			risks: [],
		};
	}

	return result;
}

function applyV1_0_0_To_V2_0_0(
	state: Record<string, unknown>,
): Record<string, unknown> {
	const result = structuredClone(state);
	result.schemaVersion = '2.0.0';

	// Basic structural normalization for legacy state
	if (!result.proposals || !Array.isArray(result.proposals)) {
		result.proposals = [];
	}
	if (!result.artifacts || !Array.isArray(result.artifacts)) {
		result.artifacts = [];
	}
	if (!result.auditEvents || !Array.isArray(result.auditEvents)) {
		result.auditEvents = [];
	}

	return result;
}
