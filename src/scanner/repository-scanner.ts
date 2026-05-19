/** Step 12.2 — Repository Scanner: read-only, bounded repository inspection */

import {
	existsSync,
	lstatSync,
	readdirSync,
	readFileSync,
	type Stats,
} from 'node:fs';
import { join, resolve } from 'node:path';
import {
	createScanFinding,
	type RepositoryScanArtifact,
	type RepositoryScanArtifactKind,
	type RepositoryScanBoundarySummary,
	type RepositoryScanCiSummary,
	type RepositoryScanConfigSummary,
	type RepositoryScanDiagnostic,
	type RepositoryScanDocumentationSummary,
	type RepositoryScanFinding,
	type RepositoryScanInput,
	type RepositoryScanOptions,
	type RepositoryScanPackageSummary,
	type RepositoryScanPolicy,
	type RepositoryScanResult,
	type RepositoryScanSecuritySummary,
	type RepositoryScanSeverity,
	type RepositoryScanTarget,
	type RepositoryScanTargetKind,
	type RepositoryScanToolingSummary,
	type RepositoryScanWorkspaceSummary,
	resetFindingCounter,
	sortScanFindings,
} from './repository-scan-model.js';
import {
	resolveScanPolicy,
	safeRelativePath,
	scanForSecrets,
} from './repository-scan-policy.js';

// ---------------------------------------------------------------------------
// Filesystem adapter for testability
// ---------------------------------------------------------------------------

export interface ScannerFsAdapter {
	exists(path: string): boolean;
	readFile(path: string): string | null;
	readDir(path: string): string[];
	lstat(path: string): Stats | null;
	isDirectory(path: string): boolean;
	isFile(path: string): boolean;
	isSymlink(path: string): boolean;
}

function createRealFs(): ScannerFsAdapter {
	return {
		exists: (path: string) => {
			try {
				return existsSync(path);
			} catch {
				return false;
			}
		},
		isDirectory: (path: string) => {
			try {
				return lstatSync(path).isDirectory();
			} catch {
				return false;
			}
		},
		isFile: (path: string) => {
			try {
				return lstatSync(path).isFile();
			} catch {
				return false;
			}
		},
		isSymlink: (path: string) => {
			try {
				return lstatSync(path).isSymbolicLink();
			} catch {
				return false;
			}
		},
		lstat: (path: string) => {
			try {
				return lstatSync(path);
			} catch {
				return null;
			}
		},
		readDir: (path: string) => {
			try {
				return readdirSync(path, { encoding: 'utf-8' });
			} catch {
				return [];
			}
		},
		readFile: (path: string) => {
			try {
				const stat = lstatSync(path);
				if (stat.size > 1024 * 1024) {
					// 1MB hard guard for safety
					return null;
				}
				return readFileSync(path, 'utf-8');
			} catch {
				return null;
			}
		},
	};
}

// ---------------------------------------------------------------------------
// Fixture-based filesystem adapter for tests
// ---------------------------------------------------------------------------

function isFixtureDir(
	path: string,
	fixtures?: Map<string, string>,
	fixtureDirectories?: Map<string, string[]>,
): boolean {
	if (fixtureDirectories?.has(path)) return true;
	// Check if any fixture or fixture directory exists under this path
	const prefix = `${path}/`;
	if (fixtures) {
		for (const key of fixtures.keys()) {
			if (key.startsWith(prefix)) return true;
		}
	}
	if (fixtureDirectories) {
		for (const key of fixtureDirectories.keys()) {
			if (key.startsWith(prefix)) return true;
		}
	}
	return false;
}

function isFixtureFile(
	path: string,
	fixtures?: Map<string, string>,
	fixtureDirectories?: Map<string, string[]>,
): boolean {
	if (fixtures?.has(path)) return true;
	// Check if listed as a file in a parent fixture directory
	const lastSlash = path.lastIndexOf('/');
	if (lastSlash >= 0) {
		const parent = path.slice(0, lastSlash);
		const name = path.slice(lastSlash + 1);
		const parentEntries = fixtureDirectories?.get(parent);
		if (parentEntries?.includes(name) && !fixtureDirectories?.has(path)) {
			return true;
		}
	}
	return false;
}

function existsFixture(
	path: string,
	fixtures?: Map<string, string>,
	fixtureDirectories?: Map<string, string[]>,
): boolean {
	if (isFixtureFile(path, fixtures)) return true;
	if (isFixtureDir(path, fixtures, fixtureDirectories)) return true;
	// Check if path is listed as an entry in a parent fixture directory
	const lastSlash = path.lastIndexOf('/');
	if (lastSlash >= 0) {
		const parent = path.slice(0, lastSlash);
		const name = path.slice(lastSlash + 1);
		const parentEntries = fixtureDirectories?.get(parent);
		if (parentEntries?.includes(name)) return true;
		// Also check from inferred directory listing
		if (fixtureDirectories) {
			const prefix = `${parent}/`;
			for (const [dir, entries] of fixtureDirectories) {
				if (dir === parent) {
					if (entries.includes(name)) return true;
				}
				if (dir.startsWith(prefix)) {
					const rest = dir.slice(prefix.length);
					const firstPart = rest.split('/')[0] ?? '';
					if (firstPart === name) return true;
				}
			}
		}
		if (fixtures) {
			const prefix = `${parent}/`;
			for (const key of fixtures.keys()) {
				if (key.startsWith(prefix)) {
					const rest = key.slice(prefix.length);
					const firstPart = rest.split('/')[0] ?? '';
					if (firstPart === name) return true;
				}
			}
		}
	}
	return false;
}

function createFixtureFs(
	fixtures?: Map<string, string>,
	fixtureDirectories?: Map<string, string[]>,
): ScannerFsAdapter {
	return {
		exists: (path: string) => {
			return existsFixture(path, fixtures, fixtureDirectories);
		},
		isDirectory: (path: string) => {
			if (fixtureDirectories?.has(path)) return true;
			if (isFixtureFile(path, fixtures)) return false;
			return isFixtureDir(path, fixtures, fixtureDirectories);
		},
		isFile: (path: string) => {
			return isFixtureFile(path, fixtures, fixtureDirectories);
		},
		isSymlink: (_path: string) => {
			return false;
		},
		lstat: (path: string) => {
			if (isFixtureFile(path, fixtures)) {
				const content = fixtures?.get(path) ?? '';
				return {
					isDirectory: () => false,
					isFile: () => true,
					isSymbolicLink: () => false,
					size: content.length,
				} as unknown as Stats;
			}
			if (isFixtureDir(path, fixtures, fixtureDirectories)) {
				return {
					isDirectory: () => true,
					isFile: () => false,
					isSymbolicLink: () => false,
					size: 4096,
				} as unknown as Stats;
			}
			return null;
		},
		readDir: (path: string) => {
			if (fixtureDirectories?.has(path)) {
				return fixtureDirectories.get(path) ?? [];
			}
			// Infer directory contents from fixtures
			const entries = new Set<string>();
			const prefix = `${path}/`;
			if (fixtures) {
				for (const key of fixtures.keys()) {
					if (key.startsWith(prefix)) {
						const rest = key.slice(prefix.length);
						const firstPart = rest.split('/')[0] ?? '';
						if (firstPart) entries.add(firstPart);
					}
				}
			}
			if (fixtureDirectories) {
				for (const [dir, _items] of fixtureDirectories) {
					if (dir.startsWith(prefix)) {
						const rest = dir.slice(prefix.length);
						const firstPart = rest.split('/')[0] ?? '';
						if (firstPart) entries.add(firstPart);
					}
				}
			}
			return [...entries];
		},
		readFile: (path: string) => {
			return fixtures?.get(path) ?? null;
		},
	};
}

// ---------------------------------------------------------------------------
// Symbolic link check
// ---------------------------------------------------------------------------

function _resolveRealPath(fs: ScannerFsAdapter, path: string): string {
	// Simple symlink resolution — for testability
	const stat = fs.lstat(path);
	if (stat?.isSymbolicLink()) {
		try {
			const { readlinkSync } = require('node:fs');
			return _resolveRealPath(fs, readlinkSync(path));
		} catch {
			return path;
		}
	}
	return path;
}

// ---------------------------------------------------------------------------
// Main scanner
// ---------------------------------------------------------------------------

/**
 * Scan a repository's structure, tooling, documentation, and configuration.
 *
 * This is a read-only, deterministic scanner. It:
 * - Inspects repository structure, package manifests, lockfiles, and configs
 * - Inspects documentation and profile directories
 * - Detects workspace presence and configuration
 * - Detects derived artifact boundary violations
 * - Detects external integration scope risks
 * - Redacts and reports secret-like values in scanned metadata
 *
 * It does NOT:
 * - Read arbitrary source code content
 * - Execute scripts or install dependencies
 * - Call network, AI providers, or external APIs
 * - Mutate files, workspace state, or artifact registry
 * - Generate canonical Markdown, HTML, Agent Packs, or Executive exports
 */
export function scanRepository(
	input: RepositoryScanInput,
	options?: RepositoryScanOptions,
): RepositoryScanResult {
	const dryRun = options?.dryRun ?? true;
	const scannedAt = input.scannedAt ?? new Date().toISOString();
	const policy = resolveScanPolicy(input.scanPolicyOverrides);

	// Merge allowlist/ignore patterns from input
	if (input.allowlistPaths) {
		policy.allowlistPaths = input.allowlistPaths;
	}
	if (input.ignorePatterns) {
		policy.ignorePatterns = input.ignorePatterns;
	}

	// Reset deterministic counters
	resetFindingCounter();

	const projectRoot = resolve(input.projectRoot);
	const diagnostics: RepositoryScanDiagnostic[] = [];

	// Create filesystem adapter — use fixtures if provided
	const fs: ScannerFsAdapter = input.fixtures
		? createFixtureFs(input.fixtures, input.fixtureDirectories)
		: createRealFs();

	const targets: RepositoryScanTarget[] = [];
	const artifacts: RepositoryScanArtifact[] = [];
	const findings: RepositoryScanFinding[] = [];
	const counters: ScanCounters = {
		bytesInspected: 0,
		directoriesInspected: 0,
		filesInspected: 0,
	};

	// -----------------------------------------------------------------------
	// 1. Repository root inspection
	// -----------------------------------------------------------------------

	const rootTarget = inspectRepositoryRoot(projectRoot, fs, policy, findings);
	targets.push(rootTarget);
	counters.directoriesInspected += 1;

	// -----------------------------------------------------------------------
	// 2. Workspace state inspection
	// -----------------------------------------------------------------------

	const workspaceSummary = inspectWorkspace(
		projectRoot,
		fs,
		policy,
		findings,
		diagnostics,
	);
	if (workspaceSummary.exists) {
		targets.push({
			exists: true,
			findingIds: [],
			kind: 'workspace_state',
			path: safeRelativePath(join(projectRoot, '.logos'), projectRoot),
			skipped: false,
		});
	}

	const activeProfileId =
		input.activeProfileId ?? workspaceSummary.activeProfileId ?? 'standard';
	const documentationRoot =
		input.documentationRoot ?? workspaceSummary.documentationRoot ?? 'logos/';

	// -----------------------------------------------------------------------
	// 3. Package manifest inspection
	// -----------------------------------------------------------------------

	const packageSummary = inspectPackage(
		projectRoot,
		fs,
		policy,
		findings,
		artifacts,
		counters.filesInspected,
		counters.bytesInspected,
	);
	if (packageSummary.exists) {
		targets.push({
			artifactKind: 'package_json',
			exists: true,
			findingIds: [],
			kind: 'package_manifest',
			path: safeRelativePath(join(projectRoot, 'package.json'), projectRoot),
			skipped: false,
		});
	}

	// Update counters from package scan
	{
		const pkgStat = fs.lstat(join(projectRoot, 'package.json'));
		if (pkgStat) {
			counters.filesInspected += 1;
			counters.bytesInspected += pkgStat.size;
		}
	}

	// -----------------------------------------------------------------------
	// 4. Lockfile inspection
	// -----------------------------------------------------------------------

	const lockfileKind = inspectLockfile(
		projectRoot,
		fs,
		policy,
		findings,
		artifacts,
	);
	if (lockfileKind) {
		const lockPath = join(projectRoot, lockfileKind);
		targets.push({
			artifactKind: lockfileKind.includes('pnpm') ? 'pnpm_lock' : 'unknown',
			exists: true,
			findingIds: [],
			kind: 'lockfile',
			path: safeRelativePath(lockPath, projectRoot),
			skipped: false,
		});
		const lockStat = fs.lstat(lockPath);
		if (lockStat) {
			counters.filesInspected += 1;
			counters.bytesInspected += lockStat.size;
		}
	}

	// -----------------------------------------------------------------------
	// 5. Config file inspection
	// -----------------------------------------------------------------------

	const configSummary = inspectConfigs(
		projectRoot,
		fs,
		policy,
		findings,
		artifacts,
	);
	for (const cfg of [
		configSummary.tsconfigPath,
		configSummary.vitestConfigPath,
		configSummary.biomeConfigPath,
		configSummary.markdownlintConfigPath,
	]) {
		if (cfg) {
			const fullPath = join(projectRoot, cfg);
			targets.push({
				artifactKind: artifactKindForConfig(cfg),
				exists: true,
				findingIds: [],
				kind: targetKindForConfig(cfg),
				path: safeRelativePath(fullPath, projectRoot),
				skipped: false,
			});
			const cfgStat = fs.lstat(fullPath);
			if (cfgStat) {
				counters.filesInspected += 1;
				counters.bytesInspected += cfgStat.size;
			}
		}
	}

	// -----------------------------------------------------------------------
	// 6. Source/test/scripts directory inspection
	// -----------------------------------------------------------------------

	const sourceDirs: string[] = [];
	const testDirs: string[] = [];
	const scriptDirs: string[] = [];

	inspectSourceStructure(
		projectRoot,
		fs,
		policy,
		findings,
		artifacts,
		sourceDirs,
		testDirs,
		scriptDirs,
		counters,
	);

	// -----------------------------------------------------------------------
	// 7. Documentation tree inspection
	// -----------------------------------------------------------------------

	const docSummary = inspectDocumentation(
		projectRoot,
		documentationRoot,
		fs,
		policy,
		findings,
		artifacts,
		counters,
	);

	// -----------------------------------------------------------------------
	// 8. Profile tree inspection
	// -----------------------------------------------------------------------

	inspectProfile(
		projectRoot,
		activeProfileId,
		fs,
		policy,
		findings,
		artifacts,
		counters,
	);

	// -----------------------------------------------------------------------
	// 9. Executive tree inspection
	// -----------------------------------------------------------------------

	inspectExecutiveTree(
		projectRoot,
		activeProfileId,
		fs,
		policy,
		findings,
		artifacts,
	);

	// -----------------------------------------------------------------------
	// 10. Generated root inspection
	// -----------------------------------------------------------------------

	inspectGeneratedRoot(
		projectRoot,
		documentationRoot,
		fs,
		policy,
		findings,
		counters,
	);

	// -----------------------------------------------------------------------
	// 11. CI workflow inspection
	// -----------------------------------------------------------------------

	const ciSummary = inspectCi(projectRoot, fs, policy, findings, artifacts);

	// -----------------------------------------------------------------------
	// Tooling summary
	// -----------------------------------------------------------------------

	const toolingSummary = buildToolingSummary(
		packageSummary,
		lockfileKind,
		configSummary,
		projectRoot,
		fs,
		policy,
	);

	// -----------------------------------------------------------------------
	// Boundary summary
	// -----------------------------------------------------------------------

	const boundarySummary = inspectBoundaries(
		projectRoot,
		documentationRoot,
		fs,
		findings,
	);

	// -----------------------------------------------------------------------
	// External integration scope scan
	// -----------------------------------------------------------------------

	inspectExternalIntegrationScope(
		projectRoot,
		activeProfileId,
		fs,
		policy,
		findings,
	);

	// -----------------------------------------------------------------------
	// Security scan
	// -----------------------------------------------------------------------

	const securitySummary = inspectSecurity(projectRoot, fs, policy, findings);

	// Sort findings deterministically
	const sortedFindings = sortScanFindings(findings);

	const targetsScanned = targets.filter((t) => !t.skipped).length;
	const targetsSkipped = targets.filter((t) => t.skipped).length;

	return {
		activeProfileId,
		artifacts,
		boundarySummary,
		bytesInspected: counters.bytesInspected,
		changedPaths: [],
		ciSummary,
		configSummary,
		diagnostics,
		directoriesInspected: counters.directoriesInspected,
		documentationRoot,
		documentationSummary: docSummary,
		dryRun,
		filesInspected: counters.filesInspected,
		findings: sortedFindings,
		packageSummary,
		profileVersion: input.profileVersion ?? null,
		readOnly: true,
		repositoryRoot: projectRoot,
		scannedAt,
		scanPolicy: policy,
		securitySummary,
		targets,
		targetsScanned,
		targetsSkipped,
		toolingSummary,
		workspaceSummary,
	};
}

// ---------------------------------------------------------------------------
// Section 1: Repository root
// ---------------------------------------------------------------------------

function inspectRepositoryRoot(
	root: string,
	fs: ScannerFsAdapter,
	_policy: RepositoryScanPolicy,
	findings: RepositoryScanFinding[],
): RepositoryScanTarget {
	const findingIds: string[] = [];

	const hasGit = fs.exists(join(root, '.git'));
	const hasPackage = fs.exists(join(root, 'package.json'));

	if (!hasGit && !hasPackage) {
		const f = createScanFinding({
			affectedPath: root,
			evidence: 'No .git directory or package.json found at repository root.',
			kind: 'missing_expected_file',
			message:
				'No repository markers (.git or package.json) detected at project root.',
			recoveryHint:
				'Ensure you are running logos from within a valid repository.',
			severity: 'warning',
			sourceCategory: 'repository_root',
			title: 'Missing repository markers',
		});
		findings.push(f);
		findingIds.push(f.id);
	}

	return {
		exists: true,
		findingIds,
		kind: 'repository_root',
		path: safeRelativePath(root, root),
		skipped: false,
	};
}

// ---------------------------------------------------------------------------
// Section 2: Workspace
// ---------------------------------------------------------------------------

function inspectWorkspace(
	root: string,
	fs: ScannerFsAdapter,
	_policy: RepositoryScanPolicy,
	_findings: RepositoryScanFinding[],
	diagnostics: RepositoryScanDiagnostic[],
): RepositoryScanWorkspaceSummary {
	const logosPath = join(root, '.logos');
	const workspaceJsonPath = join(logosPath, 'workspace.json');

	const exists = fs.exists(join(logosPath));

	let activeProfileId: string | null = null;
	let documentationRoot: string | null = null;
	let providerConfigured = false;
	let initializationState = 'missing';

	if (!exists) {
		diagnostics.push({
			code: 'workspace_state_missing',
			message: 'No .logos/ workspace directory found.',
			recoveryHint: 'Run /init to initialize the LOGOS workspace.',
			severity: 'info',
		});
		return {
			activeProfileId: null,
			documentationRoot: null,
			exists: false,
			initializationState: 'missing',
			providerConfigured: false,
		};
	}

	try {
		const content = fs.readFile(workspaceJsonPath);
		if (content) {
			const parsed = JSON.parse(content) as Record<string, unknown>;
			initializationState = 'initialized';

			if (typeof parsed.profile === 'object' && parsed.profile !== null) {
				const profile = parsed.profile as Record<string, unknown>;
				if (typeof profile.profileId === 'string') {
					activeProfileId = profile.profileId;
				}
			}

			if (
				typeof parsed.documentation === 'object' &&
				parsed.documentation !== null
			) {
				const doc = parsed.documentation as Record<string, unknown>;
				if (typeof doc.rootPath === 'string') {
					documentationRoot = doc.rootPath;
				}
			}

			if (typeof parsed.provider === 'object' && parsed.provider !== null) {
				const provider = parsed.provider as Record<string, unknown>;
				if (provider.enabled === true) {
					providerConfigured = true;
				}
			}
		} else {
			initializationState = 'partial';
		}
	} catch {
		initializationState = 'invalid';
		diagnostics.push({
			code: 'workspace_state_inconsistent',
			message: 'Could not parse .logos/workspace.json.',
			recoveryHint: 'Check the workspace file or reinitialize with /init.',
			severity: 'warning',
			sourcePath: safeRelativePath(workspaceJsonPath, root),
		});
	}

	return {
		activeProfileId,
		documentationRoot,
		exists,
		initializationState,
		providerConfigured,
	};
}

// ---------------------------------------------------------------------------
// Section 3: Package manifest
// ---------------------------------------------------------------------------

function inspectPackage(
	root: string,
	fs: ScannerFsAdapter,
	_policy: RepositoryScanPolicy,
	findings: RepositoryScanFinding[],
	_artifacts: RepositoryScanArtifact[],
	_: number,
	__: number,
): RepositoryScanPackageSummary {
	const pkgPath = join(root, 'package.json');
	const exists = fs.exists(pkgPath);

	if (!exists) {
		findings.push(
			createScanFinding({
				affectedPath: safeRelativePath(pkgPath, root),
				evidence: 'package.json not found at project root.',
				kind: 'missing_expected_file',
				message: 'No package.json found. This may not be a Node.js project.',
				recoveryHint:
					'If this is a package-based project, create a package.json.',
				severity: 'warning',
				sourceCategory: 'package_tooling',
				title: 'Missing package.json',
			}),
		);
		return {
			declaredScripts: [],
			exists: false,
			missingRequiredScripts: [],
		};
	}

	const content = fs.readFile(pkgPath);
	if (!content) {
		return {
			declaredScripts: [],
			exists: true,
			missingRequiredScripts: [],
		};
	}

	// Check for secrets in package.json
	const secretResult = scanForSecrets(content);
	if (secretResult.hasSecret) {
		findings.push(
			createScanFinding({
				affectedPath: safeRelativePath(pkgPath, root),
				evidence: `Secret-like value detected in package.json: ${secretResult.label}`,
				kind: 'secret_like_value',
				message: `Secret-like value (${secretResult.label}) found in package.json.`,
				recoveryHint:
					'Remove raw secret-like values from package.json. Use environment variables.',
				severity: 'error',
				sourceCategory: 'security',
				title: 'Secret-like value in package.json',
			}),
		);
	}

	let parsed: Record<string, unknown>;
	try {
		parsed = JSON.parse(content) as Record<string, unknown>;
	} catch {
		return {
			declaredScripts: [],
			exists: true,
			missingRequiredScripts: [],
		};
	}

	const name = typeof parsed.name === 'string' ? parsed.name : undefined;
	const version =
		typeof parsed.version === 'string' ? parsed.version : undefined;
	const type = typeof parsed.type === 'string' ? parsed.type : undefined;
	const bin =
		typeof parsed.bin === 'string'
			? parsed.bin
			: typeof parsed.bin === 'object' && parsed.bin !== null
				? selectPackageBinaryPath(parsed.bin as Record<string, unknown>)
				: undefined;

	const declaredScripts: string[] = [];
	const declaredScriptsMap: Record<string, string> = {};
	if (typeof parsed.scripts === 'object' && parsed.scripts !== null) {
		const scripts = parsed.scripts as Record<string, string>;
		for (const key of Object.keys(scripts)) {
			declaredScripts.push(key);
			declaredScriptsMap[key] = scripts[key] ?? '';
		}
	}

	const engines =
		typeof parsed.engines === 'object' && parsed.engines !== null
			? (parsed.engines as Record<string, string>)
			: undefined;
	const packageManager =
		typeof parsed.packageManager === 'string'
			? parsed.packageManager
			: undefined;

	// Check required scripts
	const requiredScripts = [
		'build',
		'test',
		'typecheck',
		'lint:biome',
		'lint:md',
		'smoke:cli',
		'check',
	];
	const missingRequiredScripts: string[] = [];
	for (const script of requiredScripts) {
		if (!declaredScripts.includes(script)) {
			missingRequiredScripts.push(script);
		}
	}

	for (const missing of missingRequiredScripts) {
		findings.push(
			createScanFinding({
				affectedPath: safeRelativePath(pkgPath, root),
				evidence: `Required script "${missing}" not declared in package.json scripts.`,
				kind: 'unexpected_missing_script',
				message: `Required script "${missing}" is missing from package.json.`,
				recoveryHint: `Add a "${missing}" script to package.json.`,
				relatedScriptName: missing,
				severity: 'warning',
				sourceCategory: 'package_tooling',
				title: `Missing required script: ${missing}`,
			}),
		);
	}

	// Check mutating check script
	const checkScript = declaredScriptsMap.check ?? '';
	if (typeof checkScript === 'string' && checkScript.includes('--write')) {
		findings.push(
			createScanFinding({
				affectedPath: safeRelativePath(pkgPath, root),
				evidence: `"check" script contains mutating flag: ${checkScript.slice(0, 80)}`,
				kind: 'script_contract_mismatch',
				message:
					'The "check" script contains a mutating flag (--write). It may not be suitable as a read-only CI check.',
				recoveryHint:
					'Consider separating the non-mutating check from the mutating format script.',
				relatedScriptName: 'check',
				severity: 'warning',
				sourceCategory: 'package_tooling',
				title: 'Mutating check script',
			}),
		);
	}

	// Check smoke script target
	const smokeScript = declaredScriptsMap['smoke:cli'] ?? '';
	if (
		typeof smokeScript === 'string' &&
		smokeScript.startsWith('node ') &&
		smokeScript.length > 5
	) {
		const targetPath = smokeScript.slice(5).split(' ')[0] ?? '';
		if (targetPath && !fs.exists(join(root, targetPath))) {
			findings.push(
				createScanFinding({
					affectedPath: safeRelativePath(pkgPath, root),
					evidence: `Smoke script target "${targetPath}" does not exist at repository root.`,
					kind: 'script_contract_mismatch',
					message: `Smoke script references "${targetPath}" which does not exist.`,
					recoveryHint: `Ensure the smoke script target file exists.`,
					relatedScriptName: 'smoke:cli',
					severity: 'error',
					sourceCategory: 'package_tooling',
					title: 'Smoke script target missing',
				}),
			);
		}
	}

	// Check package manager consistency
	const hasPnpmLock = fs.exists(join(root, 'pnpm-lock.yaml'));
	if (hasPnpmLock && packageManager && !packageManager.startsWith('pnpm')) {
		findings.push(
			createScanFinding({
				affectedPath: safeRelativePath(pkgPath, root),
				evidence: `packageManager field "${packageManager}" does not match detected pnpm-lock.yaml.`,
				kind: 'package_manager_mismatch',
				message: 'Package manager field does not match detected lockfile.',
				recoveryHint:
					'Update the packageManager field to match the detected lockfile.',
				relatedConfigKey: 'packageManager',
				severity: 'warning',
				sourceCategory: 'package_tooling',
				title: 'Package manager mismatch',
			}),
		);
	}

	return {
		binPath: bin,
		declaredScripts,
		engines,
		exists,
		missingRequiredScripts,
		name,
		packageManager,
		type,
		version,
	};
}

function selectPackageBinaryPath(
	binEntries: Record<string, unknown>,
): string | undefined {
	const logosBin = binEntries.logos;
	if (typeof logosBin === 'string') return logosBin;

	for (const value of Object.values(binEntries)) {
		if (typeof value === 'string') return value;
	}

	return undefined;
}

// ---------------------------------------------------------------------------
// Section 4: Lockfile
// ---------------------------------------------------------------------------

function inspectLockfile(
	root: string,
	fs: ScannerFsAdapter,
	_policy: RepositoryScanPolicy,
	_findings: RepositoryScanFinding[],
	_artifacts: RepositoryScanArtifact[],
): string | null {
	const candidates = ['pnpm-lock.yaml', 'package-lock.json', 'yarn.lock'];
	for (const candidate of candidates) {
		if (fs.exists(join(root, candidate))) {
			return candidate;
		}
	}
	return null;
}

// ---------------------------------------------------------------------------
// Section 5: Config files
// ---------------------------------------------------------------------------

function inspectConfigs(
	root: string,
	fs: ScannerFsAdapter,
	_policy: RepositoryScanPolicy,
	findings: RepositoryScanFinding[],
	_artifacts: RepositoryScanArtifact[],
): RepositoryScanConfigSummary {
	const configs: Array<{
		filename: string;
		key: keyof RepositoryScanConfigSummary;
	}> = [
		{ filename: 'tsconfig.json', key: 'tsconfigPath' },
		{ filename: 'vitest.config.ts', key: 'vitestConfigPath' },
		{ filename: 'biome.json', key: 'biomeConfigPath' },
		{ filename: '.markdownlint.json', key: 'markdownlintConfigPath' },
	];

	const summary: RepositoryScanConfigSummary = {
		biomeConfigPath: null,
		markdownlintConfigPath: null,
		tsconfigPath: null,
		vitestConfigPath: null,
	};

	for (const { filename, key } of configs) {
		const path = join(root, filename);
		if (fs.exists(path)) {
			summary[key] = filename;
		} else {
			findings.push(
				createScanFinding({
					affectedPath: safeRelativePath(path, root),
					evidence: `Expected config file "${filename}" not found.`,
					kind: 'tooling_config_missing',
					message: `Config file "${filename}" is missing.`,
					recoveryHint: `Create the "${filename}" configuration file.`,
					relatedConfigKey: filename,
					severity: 'info',
					sourceCategory: 'package_tooling',
					title: `Missing config: ${filename}`,
				}),
			);
		}
	}

	return summary;
}

function artifactKindForConfig(path: string): RepositoryScanArtifactKind {
	if (path.includes('tsconfig')) return 'tsconfig';
	if (path.includes('vitest')) return 'vitest_config';
	if (path.includes('biome')) return 'biome_config';
	if (path.includes('markdownlint')) return 'markdownlint_config';
	return 'unknown';
}

function targetKindForConfig(path: string): RepositoryScanTargetKind {
	if (path.includes('tsconfig')) return 'typescript_config';
	if (path.includes('vitest')) return 'test_config';
	if (path.includes('biome') || path.includes('markdownlint'))
		return 'lint_config';
	return 'unknown';
}

// ---------------------------------------------------------------------------
// Section 6: Source structure
// ---------------------------------------------------------------------------

interface ScanCounters {
	directoriesInspected: number;
	filesInspected: number;
	bytesInspected: number;
}

function inspectSourceStructure(
	root: string,
	fs: ScannerFsAdapter,
	_policy: RepositoryScanPolicy,
	findings: RepositoryScanFinding[],
	artifacts: RepositoryScanArtifact[],
	sourceDirs: string[],
	testDirs: string[],
	scriptDirs: string[],
	counters: ScanCounters,
): void {
	const candidateDirs = [
		{ artifactKind: 'source_directory' as const, name: 'src' },
		{ artifactKind: 'test_directory' as const, name: 'tests' },
		{ artifactKind: 'script_directory' as const, name: 'scripts' },
	];

	for (const { name, artifactKind } of candidateDirs) {
		const fullPath = join(root, name);
		if (fs.exists(fullPath) && fs.isDirectory(fullPath)) {
			artifacts.push({
				exists: true,
				kind: artifactKind,
				path: fullPath,
				relativePath: safeRelativePath(fullPath, root),
				targetKind: targetKindForDir(name),
			});
			counters.directoriesInspected += 1;

			if (name === 'src') sourceDirs.push(name);
			if (name === 'tests') testDirs.push(name);
			if (name === 'scripts') scriptDirs.push(name);
		} else {
			const severity: RepositoryScanSeverity = name === 'src' ? 'info' : 'info';
			findings.push(
				createScanFinding({
					affectedPath: safeRelativePath(fullPath, root),
					evidence: `Expected directory "${name}" not found.`,
					kind: 'missing_expected_directory',
					message: `Directory "${name}" is missing.`,
					recoveryHint: `Create the "${name}" directory if this is a source-based project.`,
					severity,
					sourceCategory: 'source_structure',
					title: `Missing directory: ${name}`,
				}),
			);
		}
	}
}

function targetKindForDir(name: string): RepositoryScanTargetKind {
	switch (name) {
		case 'src':
			return 'source_tree';
		case 'tests':
			return 'test_tree';
		case 'scripts':
			return 'scripts_tree';
		default:
			return 'unknown';
	}
}

// ---------------------------------------------------------------------------
// Section 7: Documentation
// ---------------------------------------------------------------------------

function inspectDocumentation(
	root: string,
	documentationRoot: string,
	fs: ScannerFsAdapter,
	policy: RepositoryScanPolicy,
	findings: RepositoryScanFinding[],
	artifacts: RepositoryScanArtifact[],
	counters: ScanCounters,
): RepositoryScanDocumentationSummary {
	const documentationDirectories: string[] = [];
	const canonicalOutputPaths: string[] = [];
	const missingCanonicalOutputs: string[] = [];
	const derivedArtifactsInCanonicalRoot: string[] = [];
	let hardcodedDocsRootDetected = false;

	// Check for docs/ directory (the old root)
	const docsDir = join(root, 'docs');
	if (fs.exists(docsDir) && fs.isDirectory(docsDir)) {
		documentationDirectories.push('docs');
		counters.directoriesInspected += 1;

		artifacts.push({
			exists: true,
			kind: 'documentation_directory',
			path: docsDir,
			relativePath: safeRelativePath(docsDir, root),
			targetKind: 'documentation_tree',
		});

		// If docs/ exists and is not the configured root, detect potential conflict
		if (
			!documentationRoot.startsWith('docs/') &&
			!documentationRoot.startsWith('docs')
		) {
			hardcodedDocsRootDetected = false;
			// But the docs/ directory content belongs to the source/normative docs
		}
	}

	// Check for the configured documentation root
	const genRootPath = join(root, documentationRoot);
	if (
		documentationRoot !== 'docs/' &&
		documentationRoot !== 'docs' &&
		fs.exists(genRootPath) &&
		fs.isDirectory(genRootPath)
	) {
		documentationDirectories.push(documentationRoot);
		counters.directoriesInspected += 1;

		artifacts.push({
			exists: true,
			kind: 'generated_documentation_root',
			path: genRootPath,
			relativePath: safeRelativePath(genRootPath, root),
			targetKind: 'generated_root',
		});
	}

	// Check if docs/ exists and config says logos/ — this is a potential conflict
	if (
		(documentationRoot === 'logos/' || documentationRoot === 'logos') &&
		docsDir &&
		fs.exists(docsDir) &&
		fs.isDirectory(docsDir) &&
		!(genRootPath && fs.exists(genRootPath) && fs.isDirectory(genRootPath))
	) {
		hardcodedDocsRootDetected = false; // docs/ is normative, not the generated root
	}

	// Detect hardcoded docs root: if config says docs/ and that's not the default
	if (documentationRoot === 'docs/' || documentationRoot === 'docs') {
		hardcodedDocsRootDetected = true;
		findings.push(
			createScanFinding({
				affectedPath: safeRelativePath(join(root, documentationRoot), root),
				evidence: `Documentation root is configured to "${documentationRoot}" which conflicts with the default generated root "logos/".`,
				kind: 'documentation_root_conflict',
				message:
					'Documentation root is set to "docs/" which conflicts with the source/normative docs directory.',
				recoveryHint:
					'Use the default "logos/" or a different directory for generated documentation.',
				severity: 'warning',
				sourceCategory: 'documentation_profile',
				title: 'Documentation root conflict',
			}),
		);
	}

	// Scan for derived artifacts in canonical root
	const derivedMarkers = [
		/html/i,
		/agent.?pack/i,
		/executive.?export/i,
		/executive.?plan/i,
		/validation.?report/i,
		/diagnostic.?report/i,
	];
	for (const dir of documentationDirectories) {
		const fullDir = join(root, dir);
		scanDirectoryForDerivedArtifacts(
			fullDir,
			root,
			fs,
			policy,
			derivedMarkers,
			derivedArtifactsInCanonicalRoot,
			findings,
			0,
		);
		if (counters.directoriesInspected > 0) counters.directoriesInspected += 1;
	}

	return {
		canonicalOutputPaths,
		configDocsRoot: documentationRoot !== 'logos/' ? documentationRoot : null,
		derivedArtifactsInCanonicalRoot,
		documentationDirectories,
		documentSchemaExists: fs.exists(
			join(root, 'profiles/standard/document.schema.yml'),
		),
		hardcodedDocsRootDetected,
		missingCanonicalOutputs,
		phaseDescriptorsExist: fs.exists(join(root, 'profiles/standard/phases')),
		profileDirectoryExists: fs.exists(join(root, 'profiles')),
		profileRegistryExists: fs.exists(join(root, 'profiles/standard/docs.yml')),
	};
}

function scanDirectoryForDerivedArtifacts(
	dir: string,
	root: string,
	fs: ScannerFsAdapter,
	_policy: RepositoryScanPolicy,
	markers: RegExp[],
	derivedPaths: string[],
	_findings: RepositoryScanFinding[],
	depth: number,
): void {
	if (depth > 3) return; // Limit depth for derived scan

	let entries: string[];
	try {
		entries = fs.readDir(dir);
	} catch {
		return;
	}

	for (const entry of entries) {
		const fullPath = join(dir, entry);
		const relativePath = safeRelativePath(fullPath, root);

		if (markers.some((m) => m.test(entry))) {
			derivedPaths.push(relativePath);
		}

		if (fs.isDirectory(fullPath) && depth < 3) {
			scanDirectoryForDerivedArtifacts(
				fullPath,
				root,
				fs,
				_policy,
				markers,
				derivedPaths,
				_findings,
				depth + 1,
			);
		}
	}
}

// ---------------------------------------------------------------------------
// Section 8: Profile
// ---------------------------------------------------------------------------

function inspectProfile(
	root: string,
	profileId: string,
	fs: ScannerFsAdapter,
	_policy: RepositoryScanPolicy,
	findings: RepositoryScanFinding[],
	artifacts: RepositoryScanArtifact[],
	counters: ScanCounters,
): void {
	const profileDir = join(root, 'profiles');
	if (!fs.exists(profileDir) || !fs.isDirectory(profileDir)) {
		findings.push(
			createScanFinding({
				affectedPath: safeRelativePath(profileDir, root),
				evidence: 'No profiles/ directory found.',
				kind: 'missing_expected_directory',
				message: 'Profile directory "profiles/" is missing.',
				recoveryHint:
					'Initialize the repository with bundled profiles or create profile descriptors.',
				severity: 'warning',
				sourceCategory: 'documentation_profile',
				title: 'Missing profile directory',
			}),
		);
		return;
	}

	artifacts.push({
		exists: true,
		kind: 'profile_directory',
		path: profileDir,
		relativePath: safeRelativePath(profileDir, root),
		targetKind: 'profile_tree',
	});
	counters.directoriesInspected += 1;

	// Check profile registry
	const registryPath = join(root, `profiles/${profileId}/docs.yml`);
	if (!fs.exists(registryPath)) {
		findings.push(
			createScanFinding({
				affectedPath: safeRelativePath(registryPath, root),
				evidence: `Profile registry not found at ${registryPath}.`,
				kind: 'tooling_config_missing',
				message: `Profile registry "profiles/${profileId}/docs.yml" is missing.`,
				recoveryHint: `Ensure the profile registry exists at profiles/${profileId}/docs.yml.`,
				relatedProfileId: profileId,
				severity: 'error',
				sourceCategory: 'documentation_profile',
				title: 'Missing profile registry',
			}),
		);
	}

	// Check document schema
	const schemaPath = join(root, `profiles/${profileId}/document.schema.yml`);
	if (!fs.exists(schemaPath)) {
		findings.push(
			createScanFinding({
				affectedPath: safeRelativePath(schemaPath, root),
				evidence: `Document schema not found at ${schemaPath}.`,
				kind: 'tooling_config_missing',
				message: `Document schema "profiles/${profileId}/document.schema.yml" is missing.`,
				recoveryHint: `Ensure the document schema exists at profiles/${profileId}/document.schema.yml.`,
				relatedProfileId: profileId,
				severity: 'error',
				sourceCategory: 'documentation_profile',
				title: 'Missing document schema',
			}),
		);
	}

	// Check phases
	const phasesDir = join(root, `profiles/${profileId}/phases`);
	if (!fs.exists(phasesDir) || !fs.isDirectory(phasesDir)) {
		findings.push(
			createScanFinding({
				affectedPath: safeRelativePath(phasesDir, root),
				evidence: `Phase descriptors directory not found at ${phasesDir}.`,
				kind: 'missing_expected_directory',
				message: `Phase descriptors directory "profiles/${profileId}/phases/" is missing.`,
				recoveryHint: `Ensure phase descriptors exist under profiles/${profileId}/phases/.`,
				relatedProfileId: profileId,
				severity: 'warning',
				sourceCategory: 'documentation_profile',
				title: 'Missing phase descriptors',
			}),
		);
	}
}

// ---------------------------------------------------------------------------
// Section 9: Executive tree
// ---------------------------------------------------------------------------

function inspectExecutiveTree(
	root: string,
	profileId: string,
	fs: ScannerFsAdapter,
	_policy: RepositoryScanPolicy,
	findings: RepositoryScanFinding[],
	artifacts: RepositoryScanArtifact[],
): void {
	const execDir = join(root, `profiles/${profileId}/executive`);
	if (fs.exists(execDir) && fs.isDirectory(execDir)) {
		artifacts.push({
			exists: true,
			kind: 'executive_mapping',
			path: execDir,
			relativePath: safeRelativePath(execDir, root),
			targetKind: 'executive_tree',
		});
	} else {
		findings.push(
			createScanFinding({
				affectedPath: safeRelativePath(execDir, root),
				evidence: `Executive directory not found at ${execDir}.`,
				kind: 'missing_expected_directory',
				message: 'Executive mapping directory is missing.',
				recoveryHint:
					'Ensure executive mapping files exist if this profile supports the executive axis.',
				relatedProfileId: profileId,
				severity: 'info',
				sourceCategory: 'documentation_profile',
				title: 'Missing executive directory',
			}),
		);
	}
}

// ---------------------------------------------------------------------------
// Section 10: Generated root
// ---------------------------------------------------------------------------

function inspectGeneratedRoot(
	root: string,
	documentationRoot: string,
	fs: ScannerFsAdapter,
	_policy: RepositoryScanPolicy,
	findings: RepositoryScanFinding[],
	counters: ScanCounters,
): void {
	const genRootPath = join(root, documentationRoot);

	if (!fs.exists(genRootPath) || !fs.isDirectory(genRootPath)) {
		findings.push(
			createScanFinding({
				affectedPath: safeRelativePath(genRootPath, root),
				evidence: `Generated documentation root "${documentationRoot}" not found.`,
				kind: 'missing_expected_directory',
				message: `Generated documentation root "${documentationRoot}" does not exist.`,
				recoveryHint: 'Run /generate to create canonical documentation.',
				severity: 'info',
				sourceCategory: 'canonical_outputs',
				title: 'Missing generated documentation root',
			}),
		);
		return;
	}

	counters.directoriesInspected += 1;
}

// ---------------------------------------------------------------------------
// Section 11: CI
// ---------------------------------------------------------------------------

function inspectCi(
	root: string,
	fs: ScannerFsAdapter,
	_policy: RepositoryScanPolicy,
	findings: RepositoryScanFinding[],
	_artifacts: RepositoryScanArtifact[],
): RepositoryScanCiSummary {
	const workflowsDir = join(root, '.github/workflows');

	if (!fs.exists(workflowsDir) || !fs.isDirectory(workflowsDir)) {
		// Only warn if there's a package.json (indicating a project)
		if (fs.exists(join(root, 'package.json'))) {
			findings.push(
				createScanFinding({
					affectedPath: safeRelativePath(workflowsDir, root),
					evidence:
						'No .github/workflows directory found for a package-based project.',
					kind: 'ci_missing',
					message: 'No CI workflows detected.',
					recoveryHint:
						'Consider adding GitHub Actions workflows for automated validation.',
					severity: 'info',
					sourceCategory: 'ci_config',
					title: 'Missing CI workflows',
				}),
			);
		}
		return {
			ciWorkflowCount: 0,
			ciWorkflowPaths: [],
			ciWorkflowsExist: false,
		};
	}

	const entries = fs.readDir(workflowsDir);
	const workflowPaths: string[] = [];

	for (const entry of entries) {
		if (entry.endsWith('.yml') || entry.endsWith('.yaml')) {
			workflowPaths.push(safeRelativePath(join(workflowsDir, entry), root));
		}
	}

	return {
		ciWorkflowCount: workflowPaths.length,
		ciWorkflowPaths: workflowPaths,
		ciWorkflowsExist: workflowPaths.length > 0,
	};
}

// ---------------------------------------------------------------------------
// Section: Tooling summary
// ---------------------------------------------------------------------------

function buildToolingSummary(
	pkg: RepositoryScanPackageSummary,
	lockfileKind: string | null,
	config: RepositoryScanConfigSummary,
	_root: string,
	_fs: ScannerFsAdapter,
	_policy: RepositoryScanPolicy,
): RepositoryScanToolingSummary {
	const missingConfigFiles: string[] = [];
	if (!config.tsconfigPath) missingConfigFiles.push('tsconfig.json');
	if (!config.vitestConfigPath) missingConfigFiles.push('vitest.config.ts');
	if (!config.biomeConfigPath) missingConfigFiles.push('biome.json');
	if (!config.markdownlintConfigPath)
		missingConfigFiles.push('.markdownlint.json');

	const mutatingScriptPatterns: string[] = [];
	// Check if format script is mutating
	if (pkg.exists) {
		// We detect this from package.json content already read
		// The mutating check was handled in inspectPackage
	}

	// Check node version
	const nodeVersionDeclared = pkg.engines?.node !== undefined;
	const pnpmVersionDeclared = pkg.packageManager !== undefined;

	// Lockfile kind mapping
	let lockfileKindResolved: string | null = null;
	if (lockfileKind) {
		if (lockfileKind === 'pnpm-lock.yaml') lockfileKindResolved = 'pnpm';
		else if (lockfileKind === 'package-lock.json') lockfileKindResolved = 'npm';
		else if (lockfileKind === 'yarn.lock') lockfileKindResolved = 'yarn';
	}

	return {
		biomeConfigExists: config.biomeConfigPath !== null,
		lockfileExists: lockfileKind !== null,
		lockfileKind: lockfileKindResolved,
		markdownlintConfigExists: config.markdownlintConfigPath !== null,
		missingConfigFiles,
		mutatingScriptPatterns,
		nodeVersionDeclared,
		packageManagerMatch:
			lockfileKind !== null && pkg.packageManager
				? (lockfileKind === 'pnpm-lock.yaml' &&
						pkg.packageManager.startsWith('pnpm')) ||
					(lockfileKind === 'package-lock.json' &&
						pkg.packageManager.startsWith('npm')) ||
					(lockfileKind === 'yarn.lock' &&
						pkg.packageManager.startsWith('yarn'))
				: null,
		pnpmVersionDeclared,
		tsconfigExists: config.tsconfigPath !== null,
		vitestConfigExists: config.vitestConfigPath !== null,
	};
}

// ---------------------------------------------------------------------------
// Section: Boundaries
// ---------------------------------------------------------------------------

function inspectBoundaries(
	root: string,
	documentationRoot: string,
	fs: ScannerFsAdapter,
	findings: RepositoryScanFinding[],
): RepositoryScanBoundarySummary {
	const derivedArtifactsMarkedCanonical: string[] = [];
	const canonicalDocsDependentOnDerived: string[] = [];
	const htmlArtifactsInCanonicalRoot: string[] = [];
	const agentPacksInCanonicalRoot: string[] = [];
	const executiveExportsInCanonicalRoot: string[] = [];
	const validationReportsMarkedCanonical: string[] = [];

	// Check if derived artifacts are in the canonical docs directory
	const docsDirPath = join(root, 'docs');
	const genRoot = join(root, documentationRoot);

	for (const checkDir of [docsDirPath, genRoot]) {
		if (fs.exists(checkDir) && fs.isDirectory(checkDir)) {
			try {
				const entries = fs.readDir(checkDir);
				for (const entry of entries) {
					if (/html/i.test(entry)) {
						htmlArtifactsInCanonicalRoot.push(
							safeRelativePath(join(checkDir, entry), root),
						);
					}
					if (/agent.?pack/i.test(entry)) {
						agentPacksInCanonicalRoot.push(
							safeRelativePath(join(checkDir, entry), root),
						);
					}
					if (/executive/i.test(entry)) {
						executiveExportsInCanonicalRoot.push(
							safeRelativePath(join(checkDir, entry), root),
						);
					}
					if (/validation.?report|diagnostic.?report/i.test(entry)) {
						validationReportsMarkedCanonical.push(
							safeRelativePath(join(checkDir, entry), root),
						);
					}
				}
			} catch {
				// Skip
			}
		}
	}

	// Findings for HTML artifacts in canonical docs
	for (const path of htmlArtifactsInCanonicalRoot) {
		findings.push(
			createScanFinding({
				affectedPath: path,
				evidence: `HTML artifact found at "${path}" — HTML artifacts are derived and should not be in canonical documentation roots.`,
				kind: 'generated_artifact_boundary_violation',
				message: `HTML artifact "${path}" is in a canonical documentation root. HTML artifacts are derived and should be stored separately.`,
				recoveryHint:
					'Move HTML artifacts to a derived output directory, not the canonical documentation root.',
				severity: 'warning',
				sourceCategory: 'derived_boundary',
				title: 'HTML artifact in canonical root',
			}),
		);
	}

	// Findings for Agent Packs in canonical docs
	for (const path of agentPacksInCanonicalRoot) {
		findings.push(
			createScanFinding({
				affectedPath: path,
				evidence: `Agent Pack artifact found at "${path}" — Agent Packs are derived and should not be in canonical documentation roots.`,
				kind: 'generated_artifact_boundary_violation',
				message: `Agent Pack artifact "${path}" is in a canonical documentation root. Agent Packs are derived artifacts.`,
				recoveryHint:
					'Move Agent Pack artifacts to a derived output directory.',
				severity: 'warning',
				sourceCategory: 'derived_boundary',
				title: 'Agent Pack in canonical root',
			}),
		);
	}

	// Findings for Executive exports in canonical docs
	for (const path of executiveExportsInCanonicalRoot) {
		findings.push(
			createScanFinding({
				affectedPath: path,
				evidence: `Executive export found at "${path}" — Executive exports are derived artifacts and should not be in canonical documentation roots.`,
				kind: 'generated_artifact_boundary_violation',
				message: `Executive export "${path}" is in a canonical documentation root. Executive exports are derived artifacts.`,
				recoveryHint: 'Move Executive exports to a derived output directory.',
				severity: 'warning',
				sourceCategory: 'derived_boundary',
				title: 'Executive export in canonical root',
			}),
		);
	}

	// Findings for validation reports marked canonical
	for (const path of validationReportsMarkedCanonical) {
		findings.push(
			createScanFinding({
				affectedPath: path,
				evidence: `Validation/diagnostic report found at "${path}" — Reports are derived and should not be treated as canonical.`,
				kind: 'derived_artifact_marked_canonical',
				message: `Validation/diagnostic report "${path}" should not be treated as canonical. Reports are derived artifacts.`,
				recoveryHint:
					'Ensure reports are stored as derived artifacts, not canonical documents.',
				severity: 'warning',
				sourceCategory: 'derived_boundary',
				title: 'Report treated as canonical',
			}),
		);
	}

	return {
		agentPacksInCanonicalRoot,
		canonicalDocsDependentOnDerived,
		derivedArtifactsMarkedCanonical,
		executiveExportsInCanonicalRoot,
		htmlArtifactsInCanonicalRoot,
		validationReportsMarkedCanonical,
	};
}

// ---------------------------------------------------------------------------
// Section: External integration scope
// ---------------------------------------------------------------------------

function inspectExternalIntegrationScope(
	root: string,
	profileId: string,
	fs: ScannerFsAdapter,
	_policy: RepositoryScanPolicy,
	findings: RepositoryScanFinding[],
): void {
	// Check for Linear/Notion mapping files
	const linearMappingPath = join(
		root,
		`profiles/${profileId}/executive/mappings/linear.mapping.yml`,
	);
	const notionMappingPath = join(
		root,
		`profiles/${profileId}/executive/mappings/notion.mapping.yml`,
	);

	if (fs.exists(linearMappingPath)) {
		// Linear mapping is a planned contract, not live sync — info only
		findings.push(
			createScanFinding({
				affectedPath: safeRelativePath(linearMappingPath, root),
				evidence:
					'Linear mapping file exists. Linear export is a planned adapter contract, not live sync. No external API calls are made.',
				kind: 'external_integration_scope_risk',
				message:
					'Linear mapping file detected. This is a planned adapter contract (file export only). No live sync is performed.',
				recoveryHint:
					'Linear export remains a file-based export. Live sync is not supported in MVP.',
				severity: 'info',
				sourceCategory: 'external_integration',
				title: 'Linear mapping is planned contract',
			}),
		);
	}

	if (fs.exists(notionMappingPath)) {
		findings.push(
			createScanFinding({
				affectedPath: safeRelativePath(notionMappingPath, root),
				evidence:
					'Notion mapping file exists. Notion export is a planned adapter contract, not live sync. No external API calls are made.',
				kind: 'external_integration_scope_risk',
				message:
					'Notion mapping file detected. This is a planned adapter contract (file export only). No live sync is performed.',
				recoveryHint:
					'Notion export remains a file-based export. Live sync is not supported in MVP.',
				severity: 'info',
				sourceCategory: 'external_integration',
				title: 'Notion mapping is planned contract',
			}),
		);
	}

	// Check for .env file presence
	const envPath = join(root, '.env');
	if (fs.exists(envPath)) {
		findings.push(
			createScanFinding({
				affectedPath: safeRelativePath(envPath, root),
				evidence: '.env file detected. Contents were not read for security.',
				kind: 'unknown_risk',
				message:
					'.env file detected at repository root. Ensure no secrets are committed. Contents were not inspected.',
				recoveryHint:
					'Ensure .env is in .gitignore and contains no committed secrets.',
				severity: 'info',
				sourceCategory: 'security',
				title: '.env file detected',
			}),
		);
	}

	// Check for GitHub issues mapping (file export only, fine)
	const githubMappingPath = join(
		root,
		`profiles/${profileId}/executive/mappings/github-issues.mapping.yml`,
	);
	if (fs.exists(githubMappingPath)) {
		// GitHub issues mapping is a file export — no live API risk
		// No finding needed, just acknowledging
	}
}

// ---------------------------------------------------------------------------
// Section: Security
// ---------------------------------------------------------------------------

function inspectSecurity(
	root: string,
	fs: ScannerFsAdapter,
	policy: RepositoryScanPolicy,
	findings: RepositoryScanFinding[],
): RepositoryScanSecuritySummary {
	let secretLikeValuesDetected = 0;

	// Scan known metadata files for secrets
	const metadataFiles = [
		'package.json',
		'tsconfig.json',
		'biome.json',
		'.markdownlint.json',
		'README.md',
		'SECURITY.md',
		'CONTRIBUTING.md',
	];

	for (const file of metadataFiles) {
		const fullPath = join(root, file);
		if (!fs.exists(fullPath)) continue;

		// Check size
		const stat = fs.lstat(fullPath);
		if (stat && stat.size > policy.maxFileSizeBytes) continue;

		const content = fs.readFile(fullPath);
		if (!content) continue;

		const secretResult = scanForSecrets(content);
		if (secretResult.hasSecret) {
			secretLikeValuesDetected += 1;

			findings.push(
				createScanFinding({
					affectedPath: safeRelativePath(fullPath, root),
					evidence: `Secret-like value detected in ${file}: ${secretResult.label}. Value has been redacted.`,
					kind: 'secret_like_value',
					message: `Secret-like value (${secretResult.label}) detected in ${file}.`,
					recoveryHint:
						'Replace raw secret-like values with environment variable references.',
					severity: 'error',
					sourceCategory: 'security',
					title: `Secret-like value in ${file}`,
				}),
			);
		}
	}

	// Check for unsafe paths
	const unsafePathDetected = false;
	// Path traversal is checked per-file in the scan policy

	const dotEnvDetected = fs.exists(join(root, '.env'));

	return {
		dotEnvDetected,
		redactedCount: secretLikeValuesDetected,
		secretLikeValuesDetected,
		unsafePathDetected,
	};
}
