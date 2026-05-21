/** Step 12.2 — Repository Scan Model: types, contracts, and statuses */

// ---------------------------------------------------------------------------
// Severity
// ---------------------------------------------------------------------------

export type RepositoryScanSeverity = 'info' | 'warning' | 'error' | 'fatal';

// ---------------------------------------------------------------------------
// Scope
// ---------------------------------------------------------------------------

export type RepositoryScanScope =
	| 'repository_root'
	| 'workspace_state'
	| 'package_tooling'
	| 'source_structure'
	| 'documentation_profile'
	| 'canonical_outputs'
	| 'derived_boundary'
	| 'external_integration'
	| 'ci_config'
	| 'security';

// ---------------------------------------------------------------------------
// Target kinds
// ---------------------------------------------------------------------------

export type RepositoryScanTargetKind =
	| 'repository_root'
	| 'workspace_state'
	| 'package_manifest'
	| 'lockfile'
	| 'typescript_config'
	| 'test_config'
	| 'lint_config'
	| 'markdownlint_config'
	| 'ci_workflow'
	| 'source_tree'
	| 'test_tree'
	| 'scripts_tree'
	| 'documentation_tree'
	| 'profile_tree'
	| 'executive_tree'
	| 'generated_root'
	| 'unknown';

export const SCAN_TARGET_KIND_ORDER: Record<RepositoryScanTargetKind, number> =
	{
		ci_workflow: 10,
		documentation_tree: 7,
		executive_tree: 9,
		generated_root: 8,
		lint_config: 5,
		lockfile: 3,
		markdownlint_config: 6,
		package_manifest: 2,
		profile_tree: 8,
		repository_root: 0,
		scripts_tree: 6,
		source_tree: 5,
		test_config: 4,
		test_tree: 6,
		typescript_config: 4,
		unknown: 11,
		workspace_state: 1,
	};

// ---------------------------------------------------------------------------
// Artifact kinds
// ---------------------------------------------------------------------------

export type RepositoryScanArtifactKind =
	| 'package_json'
	| 'pnpm_lock'
	| 'tsconfig'
	| 'vitest_config'
	| 'biome_config'
	| 'markdownlint_config'
	| 'github_workflow'
	| 'source_directory'
	| 'test_directory'
	| 'script_directory'
	| 'documentation_directory'
	| 'profile_directory'
	| 'workspace_directory'
	| 'generated_documentation_root'
	| 'executive_mapping'
	| 'unknown';

export const SCAN_ARTIFACT_KIND_ORDER: Record<
	RepositoryScanArtifactKind,
	number
> = {
	biome_config: 4,
	documentation_directory: 10,
	executive_mapping: 14,
	generated_documentation_root: 13,
	github_workflow: 6,
	markdownlint_config: 5,
	package_json: 0,
	pnpm_lock: 1,
	profile_directory: 11,
	script_directory: 9,
	source_directory: 7,
	test_directory: 8,
	tsconfig: 2,
	unknown: 15,
	vitest_config: 3,
	workspace_directory: 12,
};

// ---------------------------------------------------------------------------
// Finding kinds
// ---------------------------------------------------------------------------

export type RepositoryScanFindingKind =
	| 'missing_expected_file'
	| 'missing_expected_directory'
	| 'unexpected_missing_script'
	| 'script_contract_mismatch'
	| 'tooling_config_missing'
	| 'tooling_config_mismatch'
	| 'package_manager_mismatch'
	| 'node_version_mismatch'
	| 'documentation_root_conflict'
	| 'profile_contract_drift'
	| 'canonical_output_conflict'
	| 'workspace_state_missing'
	| 'workspace_state_inconsistent'
	| 'ci_missing'
	| 'ci_config_mismatch'
	| 'generated_artifact_boundary_violation'
	| 'derived_artifact_marked_canonical'
	| 'external_integration_scope_risk'
	| 'unsafe_path'
	| 'path_traversal'
	| 'secret_like_value'
	| 'oversized_file_skipped'
	| 'unsupported_file_skipped'
	| 'scan_policy_limit_reached'
	| 'unknown_risk';

export const SCAN_FINDING_KIND_ORDER: Record<
	RepositoryScanFindingKind,
	number
> = {
	canonical_output_conflict: 10,
	ci_config_mismatch: 14,
	ci_missing: 13,
	derived_artifact_marked_canonical: 16,
	documentation_root_conflict: 8,
	external_integration_scope_risk: 17,
	generated_artifact_boundary_violation: 15,
	missing_expected_directory: 1,
	missing_expected_file: 0,
	node_version_mismatch: 7,
	oversized_file_skipped: 21,
	package_manager_mismatch: 6,
	path_traversal: 19,
	profile_contract_drift: 9,
	scan_policy_limit_reached: 23,
	script_contract_mismatch: 3,
	secret_like_value: 18,
	tooling_config_mismatch: 5,
	tooling_config_missing: 4,
	unexpected_missing_script: 2,
	unknown_risk: 24,
	unsafe_path: 20,
	unsupported_file_skipped: 22,
	workspace_state_inconsistent: 12,
	workspace_state_missing: 11,
};

// ---------------------------------------------------------------------------
// Scan Policy
// ---------------------------------------------------------------------------

export interface RepositoryScanPolicy {
	/** Read only known small metadata/config files */
	readKnownMetadata: boolean;
	/** Do not read arbitrary source code content */
	readSourceContent: false;
	/** Max file size in bytes for content reads */
	maxFileSizeBytes: number;
	/** Max number of files to inspect */
	maxFilesInspected: number;
	/** Max directory recursion depth */
	maxRecursionDepth: number;
	/** Do not follow symlinks outside repository root */
	enforceRootBoundary: boolean;
	/** Do not execute scripts */
	executeScripts: false;
	/** Do not install dependencies */
	installDependencies: false;
	/** Do not call network */
	callNetwork: false;
	/** Explicit allowlist paths (relative to root) */
	allowlistPaths: string[];
	/** Explicit ignore patterns */
	ignorePatterns: string[];
	/** Ignored directory names */
	ignoredDirectoryNames: string[];
	/** Allowed file extensions for content reads */
	allowedExtensions: string[];
}

export const DEFAULT_SCAN_POLICY: RepositoryScanPolicy = {
	allowedExtensions: ['.json', '.yaml', '.yml', '.md', '.markdown', '.js'],
	allowlistPaths: [],
	callNetwork: false,
	enforceRootBoundary: true,
	executeScripts: false,
	ignoredDirectoryNames: [
		'node_modules',
		'.git',
		'dist',
		'build',
		'coverage',
		'.turbo',
		'.next',
		'.expo',
		'.cache',
		'.pnpm-store',
	],
	ignorePatterns: [],
	installDependencies: false,
	maxFileSizeBytes: 256 * 1024, // 256 KB
	maxFilesInspected: 2000,
	maxRecursionDepth: 8,
	readKnownMetadata: true,
	readSourceContent: false,
};

// ---------------------------------------------------------------------------
// Scan summary helpers
// ---------------------------------------------------------------------------

export interface RepositoryScanPackageSummary {
	exists: boolean;
	name?: string | undefined;
	version?: string | undefined;
	type?: string | undefined;
	binPath?: string | undefined;
	declaredScripts: string[];
	missingRequiredScripts: string[];
	engines?: Record<string, string> | undefined;
	packageManager?: string | undefined;
}

export interface RepositoryScanToolingSummary {
	lockfileKind: string | null;
	lockfileExists: boolean;
	packageManagerMatch: boolean | null;
	tsconfigExists: boolean;
	vitestConfigExists: boolean;
	biomeConfigExists: boolean;
	markdownlintConfigExists: boolean;
	nodeVersionDeclared: boolean;
	pnpmVersionDeclared: boolean;
	mutatingScriptPatterns: string[];
	missingConfigFiles: string[];
}

export interface RepositoryScanDocumentationSummary {
	documentationDirectories: string[];
	profileDirectoryExists: boolean;
	profileRegistryExists: boolean;
	documentSchemaExists: boolean;
	phaseDescriptorsExist: boolean;
	canonicalOutputPaths: string[];
	missingCanonicalOutputs: string[];
	derivedArtifactsInCanonicalRoot: string[];
	hardcodedDocsRootDetected: boolean;
	configDocsRoot: string | null;
}

export interface RepositoryScanWorkspaceSummary {
	exists: boolean;
	initializationState: string;
	activeProfileId: string | null;
	documentationRoot: string | null;
	providerConfigured: boolean;
}

export interface RepositoryScanCiSummary {
	ciWorkflowsExist: boolean;
	ciWorkflowCount: number;
	ciWorkflowPaths: string[];
}

export interface RepositoryScanConfigSummary {
	tsconfigPath: string | null;
	vitestConfigPath: string | null;
	biomeConfigPath: string | null;
	markdownlintConfigPath: string | null;
}

export interface RepositoryScanBoundarySummary {
	derivedArtifactsMarkedCanonical: string[];
	canonicalDocsDependentOnDerived: string[];
	htmlArtifactsInCanonicalRoot: string[];
	agentPacksInCanonicalRoot: string[];
	executiveExportsInCanonicalRoot: string[];
	validationReportsMarkedCanonical: string[];
}

export interface RepositoryScanSecuritySummary {
	secretLikeValuesDetected: number;
	dotEnvDetected: boolean;
	unsafePathDetected: boolean;
	redactedCount: number;
}

// ---------------------------------------------------------------------------
// Scan Target
// ---------------------------------------------------------------------------

export interface RepositoryScanTarget {
	kind: RepositoryScanTargetKind;
	path: string;
	exists: boolean;
	artifactKind?: RepositoryScanArtifactKind | undefined;
	sizeBytes?: number | undefined;
	skipped: boolean;
	skipReason?: string | undefined;
	findingIds: string[];
}

// ---------------------------------------------------------------------------
// Scan Artifact
// ---------------------------------------------------------------------------

export interface RepositoryScanArtifact {
	kind: RepositoryScanArtifactKind;
	path: string;
	relativePath: string;
	exists: boolean;
	sizeBytes?: number | undefined;
	targetKind: RepositoryScanTargetKind;
}

// ---------------------------------------------------------------------------
// Scan Finding
// ---------------------------------------------------------------------------

export interface RepositoryScanFinding {
	id: string;
	kind: RepositoryScanFindingKind;
	severity: RepositoryScanSeverity;
	title: string;
	message: string;
	affectedPath?: string | undefined;
	relatedConfigKey?: string | undefined;
	relatedScriptName?: string | undefined;
	relatedProfileId?: string | undefined;
	relatedDocumentId?: string | undefined;
	evidence: string;
	recoveryHint: string;
	sourceCategory: RepositoryScanScope;
	order: number;
}

// ---------------------------------------------------------------------------
// Scan Diagnostic
// ---------------------------------------------------------------------------

export interface RepositoryScanDiagnostic {
	code: string;
	severity: RepositoryScanSeverity;
	message: string;
	sourcePath?: string | undefined;
	pointer?: string | undefined;
	targetKind?: RepositoryScanTargetKind | undefined;
	artifactKind?: RepositoryScanArtifactKind | undefined;
	findingId?: string | undefined;
	profileId?: string | undefined;
	documentId?: string | undefined;
	expected?: unknown | undefined;
	received?: unknown | undefined;
	recoveryHint?: string | undefined;
}

// ---------------------------------------------------------------------------
// Changed Path
// ---------------------------------------------------------------------------

export interface RepositoryScanChangedPath {
	// Always empty for scanner — read-only
	readonly _empty: true;
}

// ---------------------------------------------------------------------------
// Scan Result
// ---------------------------------------------------------------------------

export interface RepositoryScanResult {
	repositoryRoot: string;
	activeProfileId: string | null;
	profileVersion: string | null;
	documentationRoot: string | null;
	scanPolicy: RepositoryScanPolicy;
	scannedAt: string;
	dryRun: boolean;
	readOnly: true;
	targetsScanned: number;
	targetsSkipped: number;
	filesInspected: number;
	directoriesInspected: number;
	bytesInspected: number;
	packageSummary: RepositoryScanPackageSummary;
	toolingSummary: RepositoryScanToolingSummary;
	documentationSummary: RepositoryScanDocumentationSummary;
	workspaceSummary: RepositoryScanWorkspaceSummary;
	ciSummary: RepositoryScanCiSummary;
	configSummary: RepositoryScanConfigSummary;
	boundarySummary: RepositoryScanBoundarySummary;
	securitySummary: RepositoryScanSecuritySummary;
	targets: RepositoryScanTarget[];
	artifacts: RepositoryScanArtifact[];
	findings: RepositoryScanFinding[];
	diagnostics: RepositoryScanDiagnostic[];
	changedPaths: [];
}

// ---------------------------------------------------------------------------
// Scan Summary (short)
// ---------------------------------------------------------------------------

export interface RepositoryScanSummary {
	repositoryRoot: string;
	findingCounts: {
		fatal: number;
		error: number;
		warning: number;
		info: number;
		total: number;
	};
	packageExists: boolean;
	workspaceExists: boolean;
	profileExists: boolean;
	ciExists: boolean;
	hasDocsRootConflict: boolean;
	hasDerivedBoundaryViolation: boolean;
	hasSecretLikeValues: boolean;
	targetsScanned: number;
	targetsSkipped: number;
	filesInspected: number;
	recommendedNextActions: string[];
}

// ---------------------------------------------------------------------------
// Scan Input
// ---------------------------------------------------------------------------

export interface RepositoryScanInput {
	/** Project root for path containment */
	projectRoot: string;
	/** Explicit scan policy overrides */
	scanPolicyOverrides?: Partial<RepositoryScanPolicy> | undefined;
	/** Injected clock timestamp (ISO 8601) */
	scannedAt?: string | undefined;
	/** Allowlist for specific paths */
	allowlistPaths?: string[] | undefined;
	/** Ignore patterns */
	ignorePatterns?: string[] | undefined;
	/** Active profile ID override */
	activeProfileId?: string | undefined;
	/** Profile version override */
	profileVersion?: string | undefined;
	/** Documentation root override */
	documentationRoot?: string | undefined;
	/** In-memory fixture files for tests (path -> content) */
	fixtures?: Map<string, string> | undefined;
	/** In-memory fixture directory listings for tests (path -> entries) */
	fixtureDirectories?: Map<string, string[]> | undefined;
	/** Dry-run marker */
	dryRun?: boolean | undefined;
}

// ---------------------------------------------------------------------------
// Scan Options
// ---------------------------------------------------------------------------

export interface RepositoryScanOptions {
	dryRun?: boolean | undefined;
	idFactory?: (() => string) | undefined;
}

// ---------------------------------------------------------------------------
// Scanner type
// ---------------------------------------------------------------------------

export type RepositoryScanner = (
	input: RepositoryScanInput,
	options?: RepositoryScanOptions,
) => RepositoryScanResult;

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

export interface RepositoryScanReport {
	summary: RepositoryScanSummary;
	scanPolicy: RepositoryScanPolicy;
	repositoryRoot: string;
	workspace: RepositoryScanWorkspaceSummary;
	packageTooling: RepositoryScanPackageSummary;
	tooling: RepositoryScanToolingSummary;
	sourceStructure: {
		sourceDirectories: string[];
		testDirectories: string[];
		scriptDirectories: string[];
	};
	documentation: RepositoryScanDocumentationSummary;
	canonicalGenerated: {
		configuredRoot: string | null;
		canonicalOutputPaths: string[];
		missingOutputs: string[];
		conflicts: string[];
	};
	derivedBoundaries: RepositoryScanBoundarySummary;
	ciConfig: RepositoryScanCiSummary;
	externalIntegrationRisks: string[];
	securityFindings: string[];
	skippedTargets: string[];
	recommendedNextActions: string[];
	boundedDisclaimer: string;
}

// ---------------------------------------------------------------------------
// Finding creation helper
// ---------------------------------------------------------------------------

let findingCounter = 0;

export function resetFindingCounter(start?: number): void {
	findingCounter = start ?? 0;
}

export function nextFindingId(): string {
	findingCounter += 1;
	return `repo-scan-finding-${findingCounter}`;
}

export function createScanFinding(params: {
	kind: RepositoryScanFindingKind;
	severity: RepositoryScanSeverity;
	title: string;
	message: string;
	affectedPath?: string | undefined;
	relatedConfigKey?: string | undefined;
	relatedScriptName?: string | undefined;
	relatedProfileId?: string | undefined;
	relatedDocumentId?: string | undefined;
	evidence: string;
	recoveryHint: string;
	sourceCategory: RepositoryScanScope;
}): RepositoryScanFinding {
	return {
		...params,
		id: nextFindingId(),
		order: 0,
	};
}

export function createScanDiagnostic(params: {
	code: string;
	severity: RepositoryScanSeverity;
	message: string;
	sourcePath?: string | undefined;
	pointer?: string | undefined;
	targetKind?: RepositoryScanTargetKind | undefined;
	artifactKind?: RepositoryScanArtifactKind | undefined;
	findingId?: string | undefined;
	profileId?: string | undefined;
	documentId?: string | undefined;
	expected?: unknown;
	received?: unknown;
	recoveryHint?: string | undefined;
}): RepositoryScanDiagnostic {
	return { ...params };
}

// ---------------------------------------------------------------------------
// Severity ordering
// ---------------------------------------------------------------------------

const SEVERITY_ORDER: Record<RepositoryScanSeverity, number> = {
	error: 1,
	fatal: 0,
	info: 3,
	warning: 2,
};

function compareSeverity(
	a: RepositoryScanSeverity,
	b: RepositoryScanSeverity,
): number {
	return (SEVERITY_ORDER[a] ?? 99) - (SEVERITY_ORDER[b] ?? 99);
}

// ---------------------------------------------------------------------------
// Finding sorting
// ---------------------------------------------------------------------------

export function sortScanFindings(
	findings: RepositoryScanFinding[],
): RepositoryScanFinding[] {
	return [...findings]
		.sort((a, b) => {
			// 1. Severity
			const sev = compareSeverity(a.severity, b.severity);
			if (sev !== 0) return sev;

			// 2. Finding kind
			const kindDiff =
				(SCAN_FINDING_KIND_ORDER[a.kind] ?? 99) -
				(SCAN_FINDING_KIND_ORDER[b.kind] ?? 99);
			if (kindDiff !== 0) return kindDiff;

			// 3. Affected path
			const pathDiff = (a.affectedPath ?? '').localeCompare(
				b.affectedPath ?? '',
			);
			if (pathDiff !== 0) return pathDiff;

			// 4. Title
			const titleDiff = a.title.localeCompare(b.title);
			if (titleDiff !== 0) return titleDiff;

			// 5. Stable id
			return a.id.localeCompare(b.id);
		})
		.map((finding, index) => ({ ...finding, order: index }));
}

// ---------------------------------------------------------------------------
// Summary helpers
// ---------------------------------------------------------------------------

export function computeScanFindingCounts(findings: RepositoryScanFinding[]): {
	fatal: number;
	error: number;
	warning: number;
	info: number;
	total: number;
} {
	const counts = { error: 0, fatal: 0, info: 0, total: 0, warning: 0 };
	for (const f of findings) {
		counts[f.severity] = (counts[f.severity] ?? 0) + 1;
	}
	counts.total = findings.length;
	return counts;
}

export function computeScanSummary(
	result: RepositoryScanResult,
): RepositoryScanSummary {
	const findingCounts = computeScanFindingCounts(result.findings);

	const recommendedNextActions: string[] = [];

	if (!result.packageSummary.exists) {
		recommendedNextActions.push(
			'Initialize a package.json if this is a package-based repository.',
		);
	}

	if (!result.workspaceSummary.exists) {
		recommendedNextActions.push('Run /init to initialize the LOGOS workspace.');
	}

	if (
		result.documentationSummary.hardcodedDocsRootDetected ||
		result.documentationSummary.configDocsRoot
	) {
		recommendedNextActions.push(
			'Review documentation root configuration for conflicts.',
		);
	}

	if (result.boundarySummary.derivedArtifactsMarkedCanonical.length > 0) {
		recommendedNextActions.push(
			'Review derived artifacts marked as canonical.',
		);
	}

	if (result.securitySummary.secretLikeValuesDetected > 0) {
		recommendedNextActions.push(
			'Replace secret-like values in config files with environment variable references.',
		);
	}

	if (result.ciSummary.ciWorkflowsExist === false) {
		recommendedNextActions.push(
			'Consider adding CI workflows for automated validation.',
		);
	}

	if (result.toolingSummary.missingConfigFiles.length > 0) {
		recommendedNextActions.push('Review missing tooling configuration files.');
	}

	return {
		ciExists: result.ciSummary.ciWorkflowsExist,
		filesInspected: result.filesInspected,
		findingCounts,
		hasDerivedBoundaryViolation:
			result.boundarySummary.derivedArtifactsMarkedCanonical.length > 0,
		hasDocsRootConflict: result.documentationSummary.hardcodedDocsRootDetected,
		hasSecretLikeValues: result.securitySummary.secretLikeValuesDetected > 0,
		packageExists: result.packageSummary.exists,
		profileExists: result.documentationSummary.profileDirectoryExists,
		recommendedNextActions,
		repositoryRoot: result.repositoryRoot,
		targetsScanned: result.targetsScanned,
		targetsSkipped: result.targetsSkipped,
		workspaceExists: result.workspaceSummary.exists,
	};
}

// ---------------------------------------------------------------------------
// Report builder
// ---------------------------------------------------------------------------

export function buildScanReport(
	result: RepositoryScanResult,
): RepositoryScanReport {
	return {
		boundedDisclaimer:
			'This scan is bounded and did not inspect full source code. Only metadata, config files, and directory structure were examined within defined policy limits.',
		canonicalGenerated: {
			canonicalOutputPaths: result.documentationSummary.canonicalOutputPaths,
			configuredRoot: result.documentationSummary.configDocsRoot,
			conflicts: [
				...result.documentationSummary.derivedArtifactsInCanonicalRoot,
			],
			missingOutputs: result.documentationSummary.missingCanonicalOutputs,
		},
		ciConfig: result.ciSummary,
		derivedBoundaries: result.boundarySummary,
		documentation: result.documentationSummary,
		externalIntegrationRisks: result.findings
			.filter((f) => f.kind === 'external_integration_scope_risk')
			.map((f) => f.message),
		packageTooling: result.packageSummary,
		recommendedNextActions: computeScanSummary(result).recommendedNextActions,
		repositoryRoot: result.repositoryRoot,
		scanPolicy: result.scanPolicy,
		securityFindings: result.findings
			.filter((f) => f.kind === 'secret_like_value')
			.map((f) => f.message),
		skippedTargets: result.targets
			.filter((t) => t.skipped)
			.map((t) => `${t.kind}: ${t.path} (${t.skipReason ?? 'unknown'})`),
		sourceStructure: {
			scriptDirectories: result.artifacts
				.filter((a) => a.kind === 'script_directory')
				.map((a) => a.relativePath),
			sourceDirectories: result.artifacts
				.filter((a) => a.kind === 'source_directory')
				.map((a) => a.relativePath),
			testDirectories: result.artifacts
				.filter((a) => a.kind === 'test_directory')
				.map((a) => a.relativePath),
		},
		summary: computeScanSummary(result),
		tooling: result.toolingSummary,
		workspace: result.workspaceSummary,
	};
}
