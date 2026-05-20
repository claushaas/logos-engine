/**
 * Package and Release Candidate Smoke Model
 *
 * Step 13.4 — Package and Release Candidate Smoke
 *
 * Defines deterministic types for release-candidate package validation.
 * All checks are read-only, non-mutating, provider-free, and network-free.
 */

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

export type PackageSmokeStatus =
	| 'pass'
	| 'pass_with_warnings'
	| 'blocked'
	| 'failed'
	| 'unknown';

export const PACKAGE_SMOKE_STATUS_ORDER: Record<PackageSmokeStatus, number> = {
	blocked: 0,
	failed: 1,
	pass: 2,
	pass_with_warnings: 3,
	unknown: 4,
};

// ---------------------------------------------------------------------------
// Check Kind
// ---------------------------------------------------------------------------

export type PackageSmokeCheckKind =
	| 'package_metadata'
	| 'package_files'
	| 'package_exclusions'
	| 'build_output'
	| 'binary_entrypoint'
	| 'runtime_import'
	| 'bundled_profile'
	| 'cli_help'
	| 'cli_version'
	| 'doctor_text'
	| 'doctor_json'
	| 'doctor_dry_run'
	| 'security_privacy'
	| 'runtime_no_network'
	| 'runtime_no_credentials'
	| 'non_interactive'
	| 'unknown';

export const PACKAGE_SMOKE_CHECK_KIND_ORDER: Record<
	PackageSmokeCheckKind,
	number
> = {
	binary_entrypoint: 4,
	build_output: 3,
	bundled_profile: 6,
	cli_help: 7,
	cli_version: 8,
	doctor_dry_run: 11,
	doctor_json: 10,
	doctor_text: 9,
	non_interactive: 15,
	package_exclusions: 2,
	package_files: 1,
	package_metadata: 0,
	runtime_import: 5,
	runtime_no_credentials: 14,
	runtime_no_network: 13,
	security_privacy: 12,
	unknown: 16,
};

// ---------------------------------------------------------------------------
// Diagnostic
// ---------------------------------------------------------------------------

export interface PackageSmokeDiagnostic {
	code: string;
	severity: 'info' | 'warning' | 'error' | 'fatal';
	message: string;
	path?: string | undefined;
	checkKind: PackageSmokeCheckKind;
	recoveryHint?: string | undefined;
}

// ---------------------------------------------------------------------------
// Check
// ---------------------------------------------------------------------------

export interface PackageSmokeCheck {
	kind: PackageSmokeCheckKind;
	status: PackageSmokeStatus;
	passed: boolean;
	diagnostics: PackageSmokeDiagnostic[];
	/** User-facing summary of this check */
	summary: string;
	/** Duration in milliseconds, if measured */
	durationMs?: number | undefined;
	/** Whether this check was skipped */
	skipped: boolean;
	/** Reason for skipping, if applicable */
	skippedReason?: string | undefined;
}

// ---------------------------------------------------------------------------
// Package Contents Entry
// ---------------------------------------------------------------------------

export interface PackageContentsEntry {
	path: string;
	included: boolean;
	explicitlyExcluded: boolean;
	/** Size in bytes if known */
	size?: number | undefined;
}

// ---------------------------------------------------------------------------
// Package Contents Finding
// ---------------------------------------------------------------------------

export interface PackageContentsFinding {
	path: string;
	kind:
		| 'required_missing'
		| 'sensitive_included'
		| 'unexpected_included'
		| 'unknown';
	severity: 'info' | 'warning' | 'error' | 'fatal';
	message: string;
	recoveryHint?: string | undefined;
}

// ---------------------------------------------------------------------------
// Package Contents Result
// ---------------------------------------------------------------------------

export interface PackageContentsResult {
	passed: boolean;
	status: PackageSmokeStatus;
	entries: PackageContentsEntry[];
	findings: PackageContentsFinding[];
	expectedIncluded: string[];
	expectedExcluded: string[];
	summary: string;
}

// ---------------------------------------------------------------------------
// Release Candidate Command Smoke Result
// ---------------------------------------------------------------------------

export interface ReleaseCandidateCommandSmokeResult {
	command: string;
	args: string[];
	exitCode: number;
	signal: string | null;
	passed: boolean;
	stdout: string;
	stderr: string;
	/** Redacted combined output for display */
	redactedOutput: string;
	/** Error message if command failed unexpectedly */
	error?: string | undefined;
	/** Whether stdout is valid JSON */
	isJsonOutput: boolean;
	diagnostics: PackageSmokeDiagnostic[];
}

// ---------------------------------------------------------------------------
// Release Candidate Changed Path
// ---------------------------------------------------------------------------

export interface ReleaseCandidateChangedPath {
	path: string;
	action: 'created' | 'modified' | 'deleted' | 'skipped';
	summary: string;
}

// ---------------------------------------------------------------------------
// Package Metadata Summary
// ---------------------------------------------------------------------------

export interface PackageMetadataSummary {
	name: string;
	version: string;
	type: string;
	binEntry: string;
	binExists: boolean;
	enginesNode: string;
	packageManager: string;
	entryPoint: string;
	typesEntry: string;
	hasBuildScript: boolean;
	hasTestScript: boolean;
	hasCheckScript: boolean;
	hasSmokeCliScript: boolean;
	isCheckMutating: boolean;
}

// ---------------------------------------------------------------------------
// Options / Input
// ---------------------------------------------------------------------------

export interface PackageSmokeOptions {
	/** Project root for resolving paths */
	projectRoot?: string | undefined;
	/** Skip specific checks */
	skip?: PackageSmokeCheckKind[] | undefined;
	/** Single check mode */
	only?: PackageSmokeCheckKind | undefined;
	/** Dry run (no mutations, but smoke is already read-only) */
	dryRun?: boolean | undefined;
	/** Strict mode: warnings become blockers */
	strict?: boolean | undefined;
	/** Check time (for deterministic snapshots) */
	checkedAt?: string | undefined;
	/** Deterministic counter seed for test reproducibility */
	_deterministicCounter?: number | undefined;
	/** Provide a package.json-like object for testing */
	_packageJson?: Record<string, unknown> | undefined;
	/** Provide package files listing for testing */
	_packageFiles?: string[] | undefined;
	/** Provide file existence results for testing */
	_fileExists?: Record<string, boolean> | undefined;
	/** Provide CLI command results for testing */
	_commandResults?:
		| Record<string, ReleaseCandidateCommandSmokeResult>
		| undefined;
	/** Provide profile loading result for testing */
	_profileLoadable?: boolean | undefined;
	/** Provide security/privacy check result for testing */
	_securityResult?: { status: string; totalFindings: number } | undefined;
	/** Simulate contents check result */
	_contentsResult?: PackageContentsResult | undefined;
}

export interface PackageSmokeInput extends PackageSmokeOptions {
	// All options serve as input
}

// ---------------------------------------------------------------------------
// Release Candidate Smoke Result
// ---------------------------------------------------------------------------

export interface ReleaseCandidateSmokeResult {
	checkedAt: string;
	packageName: string;
	packageVersion: string;
	status: PackageSmokeStatus;
	dryRun: boolean;
	readOnly: true;
	checks: PackageSmokeCheck[];
	checksByKind: Record<PackageSmokeCheckKind, PackageSmokeCheck | undefined>;
	metadataSummary: PackageMetadataSummary;
	contentsResult?: PackageContentsResult | undefined;
	commandResults: ReleaseCandidateCommandSmokeResult[];
	skippedChecks: PackageSmokeCheckKind[];
	skippedReasons: string[];
	blockers: PackageSmokeCheck[];
	warnings: PackageSmokeCheck[];
	totalChecks: number;
	passedCount: number;
	failedCount: number;
	skippedCount: number;
	recommendedNextActions: string[];
	changedPaths: ReleaseCandidateChangedPath[];
	/** Explicit statement that no package was published */
	noPackagePublished: true;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const REQUIRED_PACKAGE_FIELDS = [
	'name',
	'version',
	'type',
	'bin',
	'engines',
	'packageManager',
] as const;

export const REQUIRED_SCRIPTS = [
	'build',
	'test',
	'typecheck',
	'lint:biome',
	'lint:md',
	'smoke:cli',
	'check',
] as const;

export const PACKAGE_EXPECTED_FILES = [
	'dist',
	'profiles',
	'README.md',
	'LICENSE',
] as const;

export const PACKAGE_EXCLUDED_PATTERNS = [
	'.env',
	'.env.*',
	'.logos',
	'.logos/**',
	'node_modules',
	'node_modules/**',
	'.git',
	'.git/**',
	'coverage',
	'coverage/**',
	'backups',
	'backups/**',
] as const;

export const PACKAGE_SENSITIVE_MARKERS = [
	'/secret',
	'/credentials',
	'/tokens',
	'.env.local',
	'.env.production',
	'.env.development',
] as const;

export const SMOKE_CLI_COMMANDS: Array<{
	label: PackageSmokeCheckKind;
	args: string[];
	expectSuccess?: boolean;
	expectJson?: boolean;
}> = [
	{ args: ['--help'], expectSuccess: true, label: 'cli_help' },
	{ args: ['--version'], expectSuccess: true, label: 'cli_version' },
	{ args: ['doctor'], expectSuccess: true, label: 'doctor_text' },
	{
		args: ['doctor', '--json'],
		expectJson: true,
		expectSuccess: true,
		label: 'doctor_json',
	},
	{
		args: ['doctor', '--dry-run'],
		expectSuccess: true,
		label: 'doctor_dry_run',
	},
	{
		args: ['doctor', '--json', '--dry-run'],
		expectJson: true,
		expectSuccess: true,
		label: 'doctor_json',
	},
];

export const DIST_EXPECTED_FILES = [
	'cli.js',
	'index.js',
	'index.d.ts',
] as const;

export const BUNDLED_PROFILE_EXPECTED = [
	'docs.yml',
	'document.schema.yml',
] as const;

export const BUNDLED_PROFILE_PHASE_EXPECTED = [
	'01-foundation',
	'02-validation',
	'03-product',
	'04-engineering',
	'05-go-to-market',
	'06-operations',
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function comparePackageSmokeCheckKind(
	a: PackageSmokeCheckKind,
	b: PackageSmokeCheckKind,
): number {
	return PACKAGE_SMOKE_CHECK_KIND_ORDER[a] - PACKAGE_SMOKE_CHECK_KIND_ORDER[b];
}

export function comparePackageSmokeStatus(
	a: PackageSmokeStatus,
	b: PackageSmokeStatus,
): number {
	return PACKAGE_SMOKE_STATUS_ORDER[a] - PACKAGE_SMOKE_STATUS_ORDER[b];
}

/**
 * Sort checks deterministically by kind.
 */
export function sortPackageSmokeChecks(
	checks: PackageSmokeCheck[],
): PackageSmokeCheck[] {
	return [...checks].sort((a, b) =>
		comparePackageSmokeCheckKind(a.kind, b.kind),
	);
}

/**
 * Sort diagnostics deterministically:
 * 1. severity (most severe first)
 * 2. check kind
 * 3. path
 * 4. code
 */
export function sortPackageSmokeDiagnostics(
	diagnostics: PackageSmokeDiagnostic[],
): PackageSmokeDiagnostic[] {
	return [...diagnostics].sort((a, b) => {
		const sevA =
			a.severity === 'fatal'
				? 0
				: a.severity === 'error'
					? 1
					: a.severity === 'warning'
						? 2
						: 3;
		const sevB =
			b.severity === 'fatal'
				? 0
				: b.severity === 'error'
					? 1
					: b.severity === 'warning'
						? 2
						: 3;
		if (sevA !== sevB) return sevA - sevB;
		const kindCmp = comparePackageSmokeCheckKind(a.checkKind, b.checkKind);
		if (kindCmp !== 0) return kindCmp;
		const pathCmp = (a.path ?? '').localeCompare(b.path ?? '');
		if (pathCmp !== 0) return pathCmp;
		return a.code.localeCompare(b.code);
	});
}

/**
 * Determine overall smoke status from checks.
 */
export function determinePackageSmokeStatus(
	checks: PackageSmokeCheck[],
	options?: { strict?: boolean },
): PackageSmokeStatus {
	const hasBlocked = checks.some((c) => c.status === 'blocked');
	const hasFailed = checks.some((c) => c.status === 'failed');
	const hasPassWithWarnings = checks.some(
		(c) => c.status === 'pass_with_warnings',
	);

	if (options?.strict && hasPassWithWarnings) return 'blocked';
	if (hasBlocked || hasFailed) return 'blocked';
	if (hasPassWithWarnings) return 'pass_with_warnings';

	const allPassed = checks.every((c) => c.skipped || c.status === 'pass');
	return allPassed ? 'pass' : 'unknown';
}

/**
 * Build a stable diagnostic code for package smoke.
 */
export function packageSmokeCode(
	checkKind: PackageSmokeCheckKind,
	reason: string,
): string {
	return `LOGOS_PACKAGE_SMOKE_${checkKind.toUpperCase()}_${reason}`;
}

// Stable recovery hints
export const PACKAGE_SMOKE_RECOVERY_HINTS = {
	buildDist: 'Run "pnpm build" to regenerate dist files.',
	excludeSensitive:
		'Exclude sensitive files (.env, .logos, backups, coverage) from package publication.',
	fixBinPath:
		'Fix package.json "bin" field to point to the built CLI entrypoint.',
	fixPackageFiles:
		'Fix package.json "files" field to include required runtime assets.',
	includeBundledProfile:
		'Ensure profiles/standard is included in package files.',
	includeReadme: 'Include README.md and LICENSE in package files.',
	inspectPackageContents:
		'Run package contents check for detailed diagnostics.',
	nonInteractiveSmoke: 'Ensure smoke command runs in non-interactive mode.',
	removeCredentialsFromCheck:
		'Ensure check scripts do not require provider credentials.',
	removeNetworkFromCheck:
		'Remove network/external API usage from pnpm check scripts.',
	rerunSmoke: 'Fix the above issues and rerun package smoke.',
} as const;
