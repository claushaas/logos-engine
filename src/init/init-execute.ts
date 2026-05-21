/** Init Workspace Execute — performs safe writes to create .logos/ workspace */

import { writeJsonAtomic } from '../fs/safe-filesystem.js';
import { planInitWorkspace } from './init-plan.js';
import type {
	InitWorkspaceChangedPath,
	InitWorkspaceDiagnostic,
	InitWorkspaceOptions,
	InitWorkspacePlan,
	InitWorkspaceResult,
} from './init-types.js';

export async function initWorkspace(
	options: InitWorkspaceOptions = {},
): Promise<InitWorkspaceResult> {
	const mode = options.dryRun ? 'dry_run' : 'normal';
	const dryRun = options.dryRun ?? false;

	// 1. Plan
	const plan = await planInitWorkspace(options);

	if (!dryRun && options.confirm !== true) {
		return buildConfirmationRequiredResult(plan);
	}

	if (!plan.executable && plan.collision.kind !== 'none') {
		return buildCollisionResult(plan, dryRun);
	}

	if (!plan.executable) {
		return buildErrorResult(plan, dryRun);
	}

	// 2. Dry-run: return planned paths
	if (dryRun) {
		return buildDryRunResult(plan);
	}

	// 3. Execute: write workspace state atomically
	const writeResult = await writeJsonAtomic(
		plan.targetPaths.workspaceStateFile,
		plan.state,
		{
			_fs: options._fs,
			_testRandomId: options._testWorkspaceId?.replace(/-/g, '').slice(0, 12),
			_testTimestamp: options._testTimestamp,
			allowedBaseDir: plan.targetPaths.projectRoot,
			dryRun: false,
			policy: 'create_only',
		},
	);

	const changedPaths: InitWorkspaceChangedPath[] = [];
	const messages: string[] = [];
	const warnings = [
		...plan.diagnostics.filter((d) => d.severity === 'warning'),
	];
	const errors = [...plan.diagnostics.filter((d) => d.severity === 'error')];

	// Map safe-write changed paths to init changed paths
	for (const cp of writeResult.changedPaths) {
		changedPaths.push({
			action:
				cp.role === 'directory_created'
					? 'created'
					: cp.role === 'file_created'
						? 'created'
						: cp.role === 'planned'
							? 'planned'
							: 'modified',
			path: cp.path,
		});
	}

	// Map safe-write diagnostics to init warnings/errors
	for (const diag of writeResult.diagnostics) {
		if (diag.severity === 'error') {
			errors.push({
				code: diag.code,
				message: diag.message,
				path: diag.targetPath ?? diag.backupPath,
				recoveryHint: diag.recoveryHint,
				severity: 'error',
			});
		} else {
			warnings.push({
				code: diag.code,
				message: diag.message,
				path: diag.targetPath ?? diag.backupPath,
				recoveryHint: diag.recoveryHint,
				severity: 'warning',
			});
		}
	}

	if (writeResult.success) {
		messages.push('Workspace initialized successfully.');
		messages.push('');
		messages.push('Created paths:');
		for (const cp of changedPaths) {
			messages.push(`  [${cp.action}] ${cp.path}`);
		}

		messages.push('');
		messages.push(`Documentation root: ${plan.targetPaths.documentationRoot}`);
		messages.push(`Active profile:     ${plan.profile.profileId}`);
		messages.push('');
		messages.push('Next steps:');
		messages.push('  /status    — View workspace status');
		messages.push('  /config ai — Configure AI provider (Phase 4)');

		return {
			changedPaths,
			createdTimestamp: plan.state.workspace.createdAt,
			documentationRoot: plan.documentationRoot,
			errors,
			messages,
			mode,
			profile: plan.profile,
			status: 'success',
			success: true,
			targetPaths: plan.targetPaths,
			warnings,
		};
	}

	// Write failed
	messages.push('Workspace initialization failed.');
	for (const err of errors) {
		messages.push(`[${err.severity.toUpperCase()}] ${err.message}`);
		if (err.path) {
			messages.push(`  Path: ${err.path}`);
		}
		if (err.recoveryHint) {
			messages.push(`  Recovery: ${err.recoveryHint}`);
		}
	}

	return {
		changedPaths,
		createdTimestamp: plan.state.workspace.createdAt,
		documentationRoot: plan.documentationRoot,
		errors,
		messages,
		mode,
		profile: plan.profile,
		status: 'error',
		success: false,
		targetPaths: plan.targetPaths,
		warnings,
	};
}

// ---------------------------------------------------------------------------
// Result builders
// ---------------------------------------------------------------------------

function buildConfirmationRequiredResult(
	plan: InitWorkspacePlan,
): InitWorkspaceResult {
	const messages: string[] = [
		'Workspace initialization requires confirmation.',
		'',
		'Target paths:',
		`  .logos/ directory:   ${plan.targetPaths.logosDir}`,
		`  Workspace state file: ${plan.targetPaths.workspaceStateFile}`,
		`  Documentation root:   ${plan.targetPaths.documentationRoot}`,
		'',
		'No files have been written.',
		'Run /init --confirm to create the workspace.',
		'Run /init --dry-run for a detailed dry-run plan.',
	];

	if (plan.collision.kind !== 'none') {
		messages.splice(6, 0, '', `Collision: ${plan.collision.message}`);
		if (plan.collision.recoveryHint) {
			messages.splice(8, 0, `  Recovery: ${plan.collision.recoveryHint}`);
		}
	}

	return {
		changedPaths: [
			{ action: 'planned', path: plan.targetPaths.logosDir },
			{ action: 'planned', path: plan.targetPaths.workspaceStateFile },
		],
		createdTimestamp: plan.state.workspace.createdAt,
		documentationRoot: plan.documentationRoot,
		errors: plan.diagnostics.filter((d) => d.severity === 'error'),
		messages,
		mode: 'confirm_only',
		profile: plan.profile,
		status: plan.executable ? 'warning' : 'error',
		success: false,
		targetPaths: plan.targetPaths,
		warnings: plan.diagnostics.filter((d) => d.severity === 'warning'),
	};
}

function buildCollisionResult(
	plan: InitWorkspacePlan,
	dryRun: boolean,
): InitWorkspaceResult {
	const messages: string[] = [];
	const errors: InitWorkspaceDiagnostic[] = [];

	messages.push('Workspace collision detected.');
	messages.push('');
	messages.push(`Target:     ${plan.targetPaths.logosDir}`);
	messages.push(`State file: ${plan.targetPaths.workspaceStateFile}`);
	messages.push('');
	messages.push(`Collision: ${plan.collision.message}`);
	if (plan.collision.recoveryHint) {
		messages.push(`Recovery: ${plan.collision.recoveryHint}`);
	}
	messages.push('');
	messages.push('To force reinitialization, remove .logos/ and retry.');

	if (dryRun) {
		messages.push('');
		messages.push('(dry-run: no changes were made)');
	}

	if (plan.collision.kind !== 'none') {
		errors.push({
			code: plan.collision.kind,
			message: plan.collision.message,
			path: plan.collision.path,
			recoveryHint: plan.collision.recoveryHint,
			severity: 'error',
		});
	}

	const status: InitWorkspaceResult['status'] =
		plan.collision.kind === 'workspace_state_exists'
			? 'already_initialized'
			: 'error';

	return {
		changedPaths: [],
		createdTimestamp: plan.state.workspace.createdAt,
		documentationRoot: plan.documentationRoot,
		errors,
		messages,
		mode: dryRun ? 'dry_run' : 'normal',
		profile: plan.profile,
		status,
		success: false,
		targetPaths: plan.targetPaths,
		warnings: [],
	};
}

function buildErrorResult(
	plan: InitWorkspacePlan,
	dryRun: boolean,
): InitWorkspaceResult {
	const messages: string[] = ['Workspace initialization cannot proceed.'];
	if (dryRun) {
		messages.push('(dry-run: no changes were made)');
	}

	const errors: InitWorkspaceDiagnostic[] = plan.diagnostics.filter(
		(d) => d.severity === 'error',
	);
	const warnings: InitWorkspaceDiagnostic[] = plan.diagnostics.filter(
		(d) => d.severity === 'warning',
	);

	return {
		changedPaths: [],
		createdTimestamp: plan.state.workspace.createdAt,
		documentationRoot: plan.documentationRoot,
		errors,
		messages,
		mode: dryRun ? 'dry_run' : 'normal',
		profile: plan.profile,
		status: 'error',
		success: false,
		targetPaths: plan.targetPaths,
		warnings,
	};
}

function buildDryRunResult(plan: InitWorkspacePlan): InitWorkspaceResult {
	const messages: string[] = [];
	messages.push('Dry-run: workspace initialization plan');
	messages.push('');
	messages.push('Target paths:');
	messages.push(`  .logos/ directory:   ${plan.targetPaths.logosDir}`);
	messages.push(
		`  Workspace state file: ${plan.targetPaths.workspaceStateFile}`,
	);
	messages.push(
		`  Documentation root:   ${plan.targetPaths.documentationRoot}`,
	);
	messages.push(
		`  (Absolute:            ${plan.targetPaths.documentationRootAbsolute})`,
	);
	messages.push('');
	messages.push('Planned state:');
	messages.push(`  Schema version:  ${plan.state.schemaVersion}`);
	messages.push(`  Profile:         ${plan.profile.profileId}`);
	messages.push(`  Profile source:  ${plan.profile.source}`);
	messages.push(`  Documentation root: ${plan.documentationRoot.rootPath}`);
	messages.push(`    (Default:       ${plan.documentationRoot.isDefault})`);
	messages.push(`  Created at:      ${plan.state.workspace.createdAt}`);
	messages.push('');
	messages.push('(dry-run: no files were written)');

	return {
		changedPaths: [
			{ action: 'planned', path: plan.targetPaths.logosDir },
			{ action: 'planned', path: plan.targetPaths.workspaceStateFile },
		],
		createdTimestamp: plan.state.workspace.createdAt,
		documentationRoot: plan.documentationRoot,
		errors: [],
		messages,
		mode: 'dry_run',
		profile: plan.profile,
		status: 'dry_run',
		success: true,
		targetPaths: plan.targetPaths,
		warnings: [],
	};
}
