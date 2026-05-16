/** Init Workspace Plan — computes target paths and state without writing */

import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, join, normalize, relative, resolve } from 'node:path';
import { detectProjectRoot } from '../runtime/project-context.js';
import { WORKSPACE_STATE_SCHEMA_VERSION } from '../state/workspace-state.schema.js';
import { createDefaultWorkspaceState } from '../state/workspace-state-defaults.js';
import { validateWorkspaceState } from '../state/workspace-state-validation.js';
import type {
	InitWorkspaceCollision,
	InitWorkspaceDiagnostic,
	InitWorkspaceDocumentationRootSelection,
	InitWorkspaceOptions,
	InitWorkspacePlan,
	InitWorkspacePreflightResult,
	InitWorkspaceProfileSelection,
	InitWorkspaceTargetPaths,
} from './init-types.js';

const DEFAULT_DOCUMENTATION_ROOT = 'logos/';
const DEFAULT_PROFILE_ID = 'standard';
const LOGOS_DIR_NAME = '.logos';
const WORKSPACE_STATE_FILENAME = 'workspace.json';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function planInitWorkspace(
	options: InitWorkspaceOptions = {},
): Promise<InitWorkspacePlan> {
	const diagnostics: InitWorkspaceDiagnostic[] = [];
	const timestamp = options._testTimestamp ?? new Date().toISOString();

	// 1. Detect project root
	const detectOpts: { cwd?: string; projectRoot?: string } = {};
	if (options.projectRoot) {
		detectOpts.cwd = options.projectRoot;
		detectOpts.projectRoot = options.projectRoot;
	}
	const rootResult = detectProjectRoot(detectOpts);

	const projectRoot = rootResult.rootPath ?? rootResult.cwd;

	if (rootResult.rootKind === 'none' && !options.projectRoot) {
		diagnostics.push({
			code: 'no_project_root',
			message: 'No project root detected from the current directory.',
			path: rootResult.cwd,
			recoveryHint:
				'Run /init from within a Git repository or a directory containing package.json, or provide an explicit --root path.',
			severity: 'error',
		});
	}

	// 2. Compute target paths
	const targetPaths = computeTargetPaths(
		projectRoot,
		options.documentationRoot ?? undefined,
	);

	// 3. Validate documentation root
	const docRootSelection = validateDocumentationRoot(
		targetPaths,
		projectRoot,
		options.documentationRoot ?? undefined,
		diagnostics,
	);

	// 4. Validate and select profile
	const profileSelection = await validateProfileSelection(
		options.profileId ?? undefined,
		timestamp,
		diagnostics,
	);

	// 5. Build default workspace state
	const workspaceId = options._testWorkspaceId ?? `workspace-${timestamp}`;
	const defaultOpts: {
		workspaceId: string;
		createdAt: string;
		updatedAt: string;
		projectRootPath: string;
		profileId: string;
		profileVersion?: string;
		documentationRoot: string;
	} = {
		createdAt: timestamp,
		documentationRoot: docRootSelection.rootPath,
		profileId: profileSelection.profileId,
		projectRootPath: projectRoot,
		updatedAt: timestamp,
		workspaceId,
	};
	if (profileSelection.profileVersion) {
		defaultOpts.profileVersion = profileSelection.profileVersion;
	}
	const state = createDefaultWorkspaceState(defaultOpts);
	state.documentation.isDefault = docRootSelection.isDefault;
	state.documentation.wasExplicitlyConfigured =
		docRootSelection.wasExplicitlyConfigured;
	state.workspace.initializationState = 'initialized';
	state.workspace.initializedBy = '/init';
	state.profile.lockedAt = timestamp;
	state.profile.source = profileSelection.source;
	state.profile.profileSchemaVersion = WORKSPACE_STATE_SCHEMA_VERSION;
	if (profileSelection.registryPath) {
		state.profile.registryPath = profileSelection.registryPath;
	}

	// 6. Validate the state before proceeding
	const validation = validateWorkspaceState(state);
	if (!validation.success) {
		for (const err of validation.errors) {
			diagnostics.push({
				code: `state_validation_${err.code}`,
				message: `State validation failed: ${err.message}`,
				path: err.path,
				recoveryHint: err.recoveryHint,
				severity: 'error',
			});
		}
	}

	// 7. Detect collisions
	const collision = detectCollision(targetPaths, diagnostics);

	// 8. Serialize for inspection (safe wire)
	const stateJson = JSON.stringify(state, null, 2);

	const hasErrors = diagnostics.some((d) => d.severity === 'error');

	return {
		collision,
		diagnostics,
		documentationRoot: docRootSelection,
		executable: !hasErrors && collision.kind === 'none',
		pathsDisclosed: true,
		profile: profileSelection,
		state,
		stateJson,
		targetPaths,
	};
}

// ---------------------------------------------------------------------------
// Preflight (lighter, for display before writes)
// ---------------------------------------------------------------------------

export async function preflightInit(
	options: InitWorkspaceOptions = {},
): Promise<InitWorkspacePreflightResult> {
	const plan = await planInitWorkspace(options);

	return {
		collision: plan.collision,
		diagnostics: plan.diagnostics,
		documentationRoot: plan.documentationRoot,
		mode: options.dryRun ? 'dry_run' : 'normal',
		profile: plan.profile,
		safe: plan.executable,
		targetPaths: plan.targetPaths,
	};
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function computeTargetPaths(
	projectRoot: string,
	customRoot: string | undefined,
): InitWorkspaceTargetPaths {
	const rawRoot = customRoot ?? DEFAULT_DOCUMENTATION_ROOT;
	const normalizedRoot = normalize(rawRoot).replace(/\/$/, '') || rawRoot;
	const absoluteRoot = isAbsolute(normalizedRoot)
		? resolve(normalizedRoot)
		: resolve(projectRoot, normalizedRoot);

	return {
		documentationRoot: normalizedRoot,
		documentationRootAbsolute: absoluteRoot,
		logosDir: join(projectRoot, LOGOS_DIR_NAME),
		projectRoot,
		workspaceStateFile: join(
			projectRoot,
			LOGOS_DIR_NAME,
			WORKSPACE_STATE_FILENAME,
		),
	};
}

function validateDocumentationRoot(
	targetPaths: InitWorkspaceTargetPaths,
	projectRoot: string,
	customRoot: string | undefined,
	diagnostics: InitWorkspaceDiagnostic[],
): InitWorkspaceDocumentationRootSelection {
	const isDefault = !customRoot || customRoot === DEFAULT_DOCUMENTATION_ROOT;
	const wasExplicitlyConfigured = customRoot !== undefined && !isDefault;

	let valid = true;

	if (customRoot !== undefined) {
		if (customRoot.trim() === '') {
			diagnostics.push({
				code: 'empty_documentation_root',
				message: 'Documentation root cannot be empty.',
				path: customRoot,
				recoveryHint:
					'Provide a non-empty path such as "logos/" or "my-docs/".',
				severity: 'error',
			});
			valid = false;
		}

		const absoluteRoot = resolve(projectRoot, customRoot);
		const rel = relative(projectRoot, absoluteRoot);

		if (rel.startsWith('..') || isAbsolute(rel)) {
			diagnostics.push({
				code: 'doc_root_traversal_rejected',
				message: `Documentation root "${customRoot}" resolves outside the project root.`,
				path: customRoot,
				recoveryHint: `Provide a path inside the project root (${projectRoot}).`,
				severity: 'error',
			});
			valid = false;
		}
	}

	return {
		absolutePath: targetPaths.documentationRootAbsolute,
		isDefault,
		rootPath: targetPaths.documentationRoot,
		valid,
		wasExplicitlyConfigured,
	};
}

async function validateProfileSelection(
	profileId: string | undefined,
	_timestamp: string,
	diagnostics: InitWorkspaceDiagnostic[],
): Promise<InitWorkspaceProfileSelection> {
	const id = profileId ?? DEFAULT_PROFILE_ID;

	if (id !== DEFAULT_PROFILE_ID) {
		try {
			const { loadProfileRegistry } = await import(
				'../profiles/profile-registry.js'
			);
			const profileRoot = resolve(import.meta.dirname, '../../profiles', id);
			const registryPath = join(profileRoot, 'docs.yml');

			if (!existsSync(registryPath)) {
				diagnostics.push({
					code: 'unknown_profile',
					message: `Profile "${id}" is not available as a bundled or local profile.`,
					path: registryPath,
					recoveryHint: `Use "standard" as the profile, or verify the profile "${id}" exists under profiles/.`,
					severity: 'error',
				});
				return {
					profileId: id,
					source: 'bundled',
					validated: false,
				};
			}

			await loadProfileRegistry({
				profileId: id,
				profileRoot,
			});

			return {
				profileId: id,
				registryPath,
				source: 'bundled',
				validated: true,
			};
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : String(err);
			diagnostics.push({
				code: 'profile_load_failed',
				message: `Failed to load profile "${id}": ${message}`,
				path: id,
				recoveryHint:
					'Use "standard" as the profile, or ensure the profile configuration is valid.',
				severity: 'error',
			});
			return {
				profileId: id,
				source: 'bundled',
				validated: false,
			};
		}
	}

	// Standard profile — always valid for now
	return {
		profileId: id,
		source: 'bundled',
		validated: true,
	};
}

function detectCollision(
	targetPaths: InitWorkspaceTargetPaths,
	diagnostics: InitWorkspaceDiagnostic[],
): InitWorkspaceCollision {
	const logosExists = existsSync(targetPaths.logosDir);
	const stateExists = existsSync(targetPaths.workspaceStateFile);

	if (!logosExists && !stateExists) {
		return { kind: 'none', message: '', path: '' };
	}

	if (logosExists && !stateExists) {
		diagnostics.push({
			code: 'workspace_partial',
			message: `.logos/ directory exists but no workspace state file found.`,
			path: targetPaths.logosDir,
			recoveryHint:
				'Run /init --confirm to complete workspace initialization with a new state file.',
			severity: 'warning',
		});
		return {
			kind: 'partial_logos_dir',
			message: `.logos/ exists but is missing workspace.json`,
			path: targetPaths.logosDir,
			recoveryHint: 'Run /init --confirm to complete workspace initialization.',
		};
	}

	// State file exists — check if it's valid
	if (stateExists) {
		try {
			const raw = readFileSync(targetPaths.workspaceStateFile, 'utf-8');
			const parsed = JSON.parse(raw) as unknown;

			const validation = validateWorkspaceState(parsed);
			if (validation.success) {
				diagnostics.push({
					code: 'workspace_already_initialized',
					message: `Workspace is already initialized with a valid state file.`,
					path: targetPaths.workspaceStateFile,
					recoveryHint:
						'Use /status to view current workspace. To reinitialize, remove the existing .logos/ directory first.',
					severity: 'error',
				});
				return {
					kind: 'workspace_state_exists',
					message: 'A valid workspace is already initialized.',
					path: targetPaths.workspaceStateFile,
					recoveryHint: 'Use /status to view current workspace state.',
				};
			}

			diagnostics.push({
				code: 'workspace_invalid_state',
				message: `Existing workspace state file is invalid: ${validation.errors.map((e) => e.message).join('; ')}`,
				path: targetPaths.workspaceStateFile,
				recoveryHint:
					'Review or remove the invalid state file, then run /init --confirm.',
				severity: 'error',
			});
			return {
				kind: 'invalid_existing_state',
				message: 'Existing workspace state file is invalid.',
				path: targetPaths.workspaceStateFile,
				recoveryHint:
					'Review or remove the invalid state file, then run /init --confirm.',
			};
		} catch {
			diagnostics.push({
				code: 'workspace_state_unreadable',
				message: 'Existing workspace state file cannot be read or parsed.',
				path: targetPaths.workspaceStateFile,
				recoveryHint: 'Remove or repair the state file, then run /init.',
				severity: 'error',
			});
			return {
				kind: 'invalid_existing_state',
				message: 'Existing workspace state file is corrupted and unreadable.',
				path: targetPaths.workspaceStateFile,
				recoveryHint: 'Remove or repair the state file, then run /init.',
			};
		}
	}

	return { kind: 'none', message: '', path: '' };
}
