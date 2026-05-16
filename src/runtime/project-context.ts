/** Project context, root, and config detection — non-mutating */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

export type ProjectRootKind = 'git' | 'package' | 'explicit' | 'none';

export type WorkspaceInitializationState =
	| 'initialized'
	| 'missing'
	| 'partial'
	| 'invalid';

export interface ProjectRootDetectionResult {
	rootPath: string | null;
	rootKind: ProjectRootKind;
	inferred: boolean;
	cwd: string;
}

export interface WorkspaceDetectionResult {
	logosPath: string;
	exists: boolean;
	initializationState: WorkspaceInitializationState;
	diagnostics: ProjectContextDiagnostic[];
}

export interface DocumentationRootConfig {
	rootPath: string;
	isDefault: boolean;
}

export type ProviderConfigStatus =
	| { kind: 'configured'; providerId: string }
	| { kind: 'not_configured' }
	| { kind: 'not_supported_yet' };

export interface WorkspaceConfigDetectionResult {
	documentationRoot: DocumentationRootConfig;
	activeProfileId: string | null;
	providerStatus: ProviderConfigStatus;
	diagnostics: ProjectContextDiagnostic[];
}

export interface ProjectContextDiagnostic {
	code: string;
	severity: 'info' | 'warning' | 'error';
	message: string;
	path: string | null;
	recoveryHint: string | null;
}

export interface DetectProjectContextOptions {
	/** Explicit cwd override; defaults to process.cwd() */
	cwd?: string;
	/** Explicit project root override; skips detection */
	projectRoot?: string;
}

export interface ProjectContext {
	cwd: string;
	root: ProjectRootDetectionResult;
	workspace: WorkspaceDetectionResult;
	config: WorkspaceConfigDetectionResult;
	diagnostics: ProjectContextDiagnostic[];
}

export interface ProjectContextError {
	code: string;
	message: string;
	cause?: unknown;
}

const DEFAULT_DOCUMENTATION_ROOT = 'logos/';
const DEFAULT_PROFILE_ID = 'standard';
const LOGOS_DIR_NAME = '.logos';

function readJsonSafe(path: string): unknown | null {
	try {
		const text = readFileSync(path, 'utf-8');
		return JSON.parse(text) as unknown;
	} catch {
		return null;
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function detectProjectRoot(
	options: DetectProjectContextOptions = {},
): ProjectRootDetectionResult {
	const cwd = options.cwd ? resolve(options.cwd) : process.cwd();

	if (options.projectRoot) {
		return {
			cwd,
			inferred: false,
			rootKind: 'explicit',
			rootPath: resolve(options.projectRoot),
		};
	}

	let current = cwd;
	let packageRoot: string | null = null;

	while (true) {
		const gitDir = join(current, '.git');
		if (existsSync(gitDir)) {
			return {
				cwd,
				inferred: true,
				rootKind: 'git',
				rootPath: current,
			};
		}

		const packageJson = join(current, 'package.json');
		const pnpmWorkspace = join(current, 'pnpm-workspace.yaml');
		if (
			packageRoot === null &&
			(existsSync(packageJson) || existsSync(pnpmWorkspace))
		) {
			packageRoot = current;
		}

		const parent = dirname(current);
		if (parent === current) {
			break;
		}
		current = parent;
	}

	if (packageRoot !== null) {
		return {
			cwd,
			inferred: true,
			rootKind: 'package',
			rootPath: packageRoot,
		};
	}

	return {
		cwd,
		inferred: true,
		rootKind: 'none',
		rootPath: null,
	};
}

export function detectWorkspace(
	rootResult: ProjectRootDetectionResult,
): WorkspaceDetectionResult {
	const basePath = rootResult.rootPath ?? rootResult.cwd;
	const logosPath = join(basePath, LOGOS_DIR_NAME);
	const exists = existsSync(logosPath);

	const diagnostics: ProjectContextDiagnostic[] = [];

	if (!exists) {
		diagnostics.push({
			code: 'workspace_missing',
			message: `Workspace directory not found at ${logosPath}`,
			path: logosPath,
			recoveryHint: 'Run /init to create a LOGOS workspace.',
			severity: 'info',
		});
		return {
			diagnostics,
			exists: false,
			initializationState: 'missing',
			logosPath,
		};
	}

	// Look for a minimal config file to determine initialization state
	const configPath = join(logosPath, 'workspace.json');
	const altConfigPath = join(logosPath, 'config.json');
	const _statePath = join(logosPath, 'state.json');

	const configFile = existsSync(configPath)
		? configPath
		: existsSync(altConfigPath)
			? altConfigPath
			: null;

	if (configFile === null) {
		diagnostics.push({
			code: 'workspace_partial',
			message: `Workspace directory exists but no config file found`,
			path: logosPath,
			recoveryHint: 'Run /init to complete workspace initialization.',
			severity: 'warning',
		});
		return {
			diagnostics,
			exists: true,
			initializationState: 'partial',
			logosPath,
		};
	}

	const parsed = readJsonSafe(configFile);
	if (!isRecord(parsed)) {
		diagnostics.push({
			code: 'workspace_invalid',
			message: `Workspace config file exists but cannot be parsed`,
			path: configFile,
			recoveryHint: 'Review or remove the invalid config file, then run /init.',
			severity: 'warning',
		});
		return {
			diagnostics,
			exists: true,
			initializationState: 'invalid',
			logosPath,
		};
	}

	// Config exists and is valid JSON — treat as initialized for this step.
	// We do not enforce a full schema because Step 3.1 will own workspace schemas.
	return {
		diagnostics,
		exists: true,
		initializationState: 'initialized',
		logosPath,
	};
}

export function detectWorkspaceConfig(
	workspaceResult: WorkspaceDetectionResult,
): WorkspaceConfigDetectionResult {
	const diagnostics: ProjectContextDiagnostic[] = [];

	if (
		!workspaceResult.exists ||
		workspaceResult.initializationState !== 'initialized'
	) {
		return {
			activeProfileId: DEFAULT_PROFILE_ID,
			diagnostics,
			documentationRoot: {
				isDefault: true,
				rootPath: DEFAULT_DOCUMENTATION_ROOT,
			},
			providerStatus: { kind: 'not_configured' },
		};
	}

	const configPath = join(workspaceResult.logosPath, 'workspace.json');
	const altConfigPath = join(workspaceResult.logosPath, 'config.json');
	const configFile = existsSync(configPath)
		? configPath
		: existsSync(altConfigPath)
			? altConfigPath
			: null;

	let documentationRoot: DocumentationRootConfig = {
		isDefault: true,
		rootPath: DEFAULT_DOCUMENTATION_ROOT,
	};
	let activeProfileId: string | null = null;
	let providerStatus: ProviderConfigStatus = { kind: 'not_configured' };

	if (configFile) {
		const parsed = readJsonSafe(configFile);
		if (isRecord(parsed)) {
			if (typeof parsed.documentationRoot === 'string') {
				documentationRoot = {
					isDefault: parsed.documentationRoot === DEFAULT_DOCUMENTATION_ROOT,
					rootPath: parsed.documentationRoot,
				};
			}
			if (typeof parsed.activeProfile === 'string') {
				activeProfileId = parsed.activeProfile;
			} else if (typeof parsed.profileId === 'string') {
				activeProfileId = parsed.profileId;
			}
			if (isRecord(parsed.provider)) {
				const providerId =
					typeof parsed.provider.providerId === 'string'
						? parsed.provider.providerId
						: typeof parsed.provider.id === 'string'
							? parsed.provider.id
							: 'unknown';
				providerStatus = { kind: 'configured', providerId };
			} else if (parsed.provider === null || parsed.provider === undefined) {
				providerStatus = { kind: 'not_configured' };
			}
		} else {
			diagnostics.push({
				code: 'config_unreadable',
				message: 'Workspace config file exists but could not be parsed',
				path: configFile,
				recoveryHint: 'Review the config file or reinitialize the workspace.',
				severity: 'warning',
			});
		}
	}

	// Fall back to defaults when not configured
	if (activeProfileId === null) {
		activeProfileId = DEFAULT_PROFILE_ID;
	}

	return {
		activeProfileId,
		diagnostics,
		documentationRoot,
		providerStatus,
	};
}

export function detectProjectContext(
	options: DetectProjectContextOptions = {},
): ProjectContext {
	const root = detectProjectRoot(options);
	const workspace = detectWorkspace(root);
	const config = detectWorkspaceConfig(workspace);

	const diagnostics: ProjectContextDiagnostic[] = [
		...rootDiagnostics(root),
		...workspace.diagnostics,
		...config.diagnostics,
	];

	if (workspace.initializationState === 'missing') {
		diagnostics.push({
			code: 'init_needed',
			message: 'LOGOS workspace is not initialized.',
			path: workspace.logosPath,
			recoveryHint:
				'Run /init to initialize the workspace before using generation or intake.',
			severity: 'info',
		});
	}

	return {
		config,
		cwd: root.cwd,
		diagnostics,
		root,
		workspace,
	};
}

function rootDiagnostics(
	root: ProjectRootDetectionResult,
): ProjectContextDiagnostic[] {
	const diagnostics: ProjectContextDiagnostic[] = [];
	if (root.rootKind === 'none') {
		diagnostics.push({
			code: 'root_none',
			message: 'No project root detected from current directory.',
			path: root.cwd,
			recoveryHint:
				'Run from within a Git repository or a directory containing a package.json.',
			severity: 'info',
		});
	}
	return diagnostics;
}

/** Format provider status for display — never exposes secrets */
export function formatProviderStatus(status: ProviderConfigStatus): string {
	switch (status.kind) {
		case 'configured':
			return `configured (${status.providerId})`;
		case 'not_configured':
			return 'not configured';
		case 'not_supported_yet':
			return 'not supported yet';
	}
}

/** Format initialization state for display */
export function formatInitializationState(
	state: WorkspaceInitializationState,
): string {
	switch (state) {
		case 'initialized':
			return 'initialized';
		case 'missing':
			return 'not initialized';
		case 'partial':
			return 'partial';
		case 'invalid':
			return 'invalid';
	}
}

/** Format project context for human-readable CLI/TUI output */
export function formatProjectContextLines(ctx: ProjectContext): string[] {
	const lines: string[] = [];
	lines.push(`Current working directory: ${ctx.cwd}`);
	lines.push(
		`Project root:              ${ctx.root.rootPath ?? 'not detected'} (${ctx.root.rootKind})`,
	);
	lines.push(`.logos/ path:              ${ctx.workspace.logosPath}`);
	lines.push(
		`Initialization state:      ${formatInitializationState(ctx.workspace.initializationState)}`,
	);
	lines.push(
		`Documentation root:        ${ctx.config.documentationRoot.rootPath}`,
	);
	lines.push(
		`Active profile:            ${ctx.config.activeProfileId ?? 'unknown'}`,
	);
	lines.push(
		`Provider status:           ${formatProviderStatus(ctx.config.providerStatus)}`,
	);

	for (const diag of ctx.diagnostics) {
		if (diag.recoveryHint) {
			lines.push(`[${diag.severity.toUpperCase()}] ${diag.message}`);
			lines.push(`  Recovery: ${diag.recoveryHint}`);
		} else {
			lines.push(`[${diag.severity.toUpperCase()}] ${diag.message}`);
		}
	}

	return lines;
}
