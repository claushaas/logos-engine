/**
 * Security and Privacy Release Check Model
 *
 * Step 13.3 — Complete Security and Privacy Release Checks
 *
 * Defines deterministic types for release-oriented security/privacy checking.
 * All checks are read-only, non-mutating, provider-free, and network-free.
 */

// ---------------------------------------------------------------------------
// Severity
// ---------------------------------------------------------------------------

export type SecurityPrivacyReleaseSeverity =
	| 'info'
	| 'warning'
	| 'error'
	| 'fatal';

export const SECURITY_PRIVACY_RELEASE_SEVERITY_ORDER: Record<
	SecurityPrivacyReleaseSeverity,
	number
> = {
	error: 1,
	fatal: 0,
	info: 3,
	warning: 2,
};

// ---------------------------------------------------------------------------
// Finding Kind
// ---------------------------------------------------------------------------

export type SecurityPrivacyReleaseFindingKind =
	| 'raw_secret_detected'
	| 'raw_provider_token_detected'
	| 'authorization_header_detected'
	| 'private_key_detected'
	| 'env_file_content_detected'
	| 'raw_prompt_detected'
	| 'raw_model_response_detected'
	| 'private_chat_history_detected'
	| 'credential_in_url_detected'
	| 'unsafe_absolute_path_detected'
	| 'path_traversal_detected'
	| 'provider_token_persisted'
	| 'provider_credentials_required_by_default'
	| 'network_required_by_default'
	| 'external_api_called_by_default'
	| 'telemetry_or_analytics_detected'
	| 'remote_logging_detected'
	| 'crash_upload_detected'
	| 'cloud_backup_detected'
	| 'external_sync_detected'
	| 'generated_artifact_marked_canonical'
	| 'derived_artifact_used_as_source'
	| 'unsafe_html_detected'
	| 'unsafe_agent_pack_instruction_detected'
	| 'unsafe_executive_export_detected'
	| 'unsafe_import_or_scanner_scope_detected'
	| 'package_includes_sensitive_file'
	| 'package_includes_generated_workspace_state'
	| 'package_includes_env_file'
	| 'package_includes_private_artifact'
	| 'mutating_check_script_detected'
	| 'test_requires_network_or_credentials'
	| 'dependency_surface_risk'
	| 'insufficient_security_evidence'
	| 'unknown_security_risk';

export const SECURITY_PRIVACY_RELEASE_FINDING_KIND_ORDER: Record<
	SecurityPrivacyReleaseFindingKind,
	number
> = {
	authorization_header_detected: 2,
	cloud_backup_detected: 18,
	crash_upload_detected: 17,
	credential_in_url_detected: 8,
	dependency_surface_risk: 31,
	derived_artifact_used_as_source: 21,
	env_file_content_detected: 4,
	external_api_called_by_default: 14,
	external_sync_detected: 19,
	generated_artifact_marked_canonical: 20,
	insufficient_security_evidence: 32,
	mutating_check_script_detected: 29,
	network_required_by_default: 13,
	package_includes_env_file: 27,
	package_includes_generated_workspace_state: 26,
	package_includes_private_artifact: 28,
	package_includes_sensitive_file: 25,
	path_traversal_detected: 10,
	private_chat_history_detected: 7,
	private_key_detected: 3,
	provider_credentials_required_by_default: 12,
	provider_token_persisted: 11,
	raw_model_response_detected: 6,
	raw_prompt_detected: 5,
	raw_provider_token_detected: 1,
	raw_secret_detected: 0,
	remote_logging_detected: 16,
	telemetry_or_analytics_detected: 15,
	test_requires_network_or_credentials: 30,
	unknown_security_risk: 33,
	unsafe_absolute_path_detected: 9,
	unsafe_agent_pack_instruction_detected: 23,
	unsafe_executive_export_detected: 24,
	unsafe_html_detected: 22,
	unsafe_import_or_scanner_scope_detected: 23,
};

// ---------------------------------------------------------------------------
// Scope
// ---------------------------------------------------------------------------

export type SecurityPrivacyReleaseScope =
	| 'codebase'
	| 'package'
	| 'dependencies'
	| 'scripts'
	| 'artifacts'
	| 'state'
	| 'backups'
	| 'logs'
	| 'network'
	| 'provider'
	| 'unknown';

// ---------------------------------------------------------------------------
// Check Category
// ---------------------------------------------------------------------------

export type SecurityPrivacyReleaseCheckCategory =
	| 'redaction'
	| 'provider_config'
	| 'workspace_state'
	| 'generated_artifacts'
	| 'reports'
	| 'backups'
	| 'logs'
	| 'package_contents'
	| 'scripts'
	| 'network'
	| 'external_integrations'
	| 'derived_artifact_boundary'
	| 'html_safety'
	| 'agent_pack_safety'
	| 'executive_export_safety'
	| 'scanner_import_safety'
	| 'dependency_surface'
	| 'unknown';

export const SECURITY_PRIVACY_CHECK_CATEGORY_ORDER: Record<
	SecurityPrivacyReleaseCheckCategory,
	number
> = {
	agent_pack_safety: 13,
	backups: 5,
	dependency_surface: 16,
	derived_artifact_boundary: 11,
	executive_export_safety: 14,
	external_integrations: 10,
	generated_artifacts: 3,
	html_safety: 12,
	logs: 6,
	network: 9,
	package_contents: 7,
	provider_config: 1,
	redaction: 0,
	reports: 4,
	scanner_import_safety: 15,
	scripts: 8,
	unknown: 17,
	workspace_state: 2,
};

// ---------------------------------------------------------------------------
// Release Status
// ---------------------------------------------------------------------------

export type SecurityPrivacyReleaseStatus =
	| 'pass'
	| 'pass_with_warnings'
	| 'blocked'
	| 'unknown';

export const SECURITY_PRIVACY_RELEASE_STATUS_ORDER: Record<
	SecurityPrivacyReleaseStatus,
	number
> = {
	blocked: 0,
	pass: 1,
	pass_with_warnings: 2,
	unknown: 3,
};

// ---------------------------------------------------------------------------
// Evidence
// ---------------------------------------------------------------------------

export interface SecurityPrivacyReleaseEvidence {
	source: string;
	path?: string | undefined;
	snippet?: string | undefined;
	summary: string;
}

// ---------------------------------------------------------------------------
// Finding
// ---------------------------------------------------------------------------

export interface SecurityPrivacyReleaseFinding {
	id: string;
	kind: SecurityPrivacyReleaseFindingKind;
	severity: SecurityPrivacyReleaseSeverity;
	category: SecurityPrivacyReleaseCheckCategory;
	message: string;
	path?: string | undefined;
	pointer?: string | undefined;
	evidence?: SecurityPrivacyReleaseEvidence | undefined;
	recoveryHint?: string | undefined;
	diagnosticCode?: string | undefined;
}

// ---------------------------------------------------------------------------
// Diagnostic
// ---------------------------------------------------------------------------

export interface SecurityPrivacyReleaseDiagnostic {
	code: string;
	severity: SecurityPrivacyReleaseSeverity;
	message: string;
	path?: string | undefined;
	recoveryHint?: string | undefined;
}

// ---------------------------------------------------------------------------
// Redaction Result
// ---------------------------------------------------------------------------

export interface SecurityPrivacyReleaseRedactionResult {
	checkedCount: number;
	redactedCount: number;
	findingCount: number;
	categories: string[];
	summary: string;
}

// ---------------------------------------------------------------------------
// Sub-checks
// ---------------------------------------------------------------------------

export interface SecurityPrivacyReleasePackageCheck {
	passed: boolean;
	expectedFiles: string[];
	blockedBy: string[];
	missingExpected: string[];
	unexpectedSensitive: string[];
	summary: string;
	findings: SecurityPrivacyReleaseFinding[];
}

export interface SecurityPrivacyReleaseNetworkCheck {
	passed: boolean;
	detectedNetworkPatterns: string[];
	detectedExternalToolPatterns: string[];
	detectedTelemetryPatterns: string[];
	summary: string;
	findings: SecurityPrivacyReleaseFinding[];
}

export interface SecurityPrivacyReleaseProviderCheck {
	passed: boolean;
	hasRawToken: boolean;
	hasEnvRefOnly: boolean;
	requiresCredentialsByDefault: boolean;
	rawPromptsDetected: boolean;
	rawResponsesDetected: boolean;
	summary: string;
	findings: SecurityPrivacyReleaseFinding[];
}

export interface SecurityPrivacyReleaseArtifactCheck {
	passed: boolean;
	canonicalBoundaryViolations: string[];
	unsafeHtml: string[];
	unsafeAgentPacks: string[];
	unsafeExecutiveExports: string[];
	summary: string;
	findings: SecurityPrivacyReleaseFinding[];
}

export interface SecurityPrivacyReleaseStateCheck {
	passed: boolean;
	rawTokensDetected: boolean;
	rawPromptsDetected: boolean;
	secretInRegistry: boolean;
	secretInRunMetadata: boolean;
	secretInSessionMetadata: boolean;
	summary: string;
	findings: SecurityPrivacyReleaseFinding[];
}

export interface SecurityPrivacyReleaseBackupCheck {
	passed: boolean;
	envContentsDetected: boolean;
	secretInManifest: boolean;
	secretInBackupFiles: boolean;
	summary: string;
	findings: SecurityPrivacyReleaseFinding[];
}

export interface SecurityPrivacyReleaseLogCheck {
	passed: boolean;
	secretsInLogs: boolean;
	summary: string;
	findings: SecurityPrivacyReleaseFinding[];
}

// ---------------------------------------------------------------------------
// Category Summary
// ---------------------------------------------------------------------------

export interface SecurityPrivacyReleaseCategorySummary {
	category: SecurityPrivacyReleaseCheckCategory;
	passed: boolean;
	findingCount: number;
	errorCount: number;
	fatalCount: number;
	warningCount: number;
	infoCount: number;
}

// ---------------------------------------------------------------------------
// Changed Path
// ---------------------------------------------------------------------------

export interface SecurityPrivacyReleaseChangedPath {
	path: string;
	action: string;
}

// ---------------------------------------------------------------------------
// Check Options
// ---------------------------------------------------------------------------

export interface SecurityPrivacyReleaseCheckOptions {
	strict?: boolean;
	dryRun?: boolean;
	projectRoot?: string | undefined;
	packageVersion?: string | undefined;
	packageName?: string | undefined;
	profileId?: string | undefined;
	profileVersion?: string | undefined;
	checkedAt?: string | undefined;
	/** Provide a package.json-like object for testing */
	_packageJson?: Record<string, unknown> | undefined;
	/** Provide package files listing for testing */
	_packageFiles?: string[] | undefined;
	/** Provide devDependencies/dependencies listing for testing */
	_dependencyNames?: string[] | undefined;
	/** Provide script definitions for testing */
	_scripts?: Record<string, string> | undefined;
	/** Provide check content (Markdown, HTML, etc.) for testing */
	_checkContent?: Record<string, string> | undefined;
	/** Provider config state snapshot for testing */
	_providerConfig?: Record<string, unknown> | undefined;
	/** Workspace state snapshot for testing */
	_workspaceState?: Record<string, unknown> | undefined;
	/** Backup manifest snapshot for testing */
	_backupManifest?: Record<string, unknown> | undefined;
	/** Run/session metadata snapshot for testing */
	_runMetadata?: Record<string, unknown> | undefined;
}

// ---------------------------------------------------------------------------
// Check Input
// ---------------------------------------------------------------------------

export interface SecurityPrivacyReleaseCheckInput
	extends SecurityPrivacyReleaseCheckOptions {
	// All options serve as input
}

// ---------------------------------------------------------------------------
// Check Result
// ---------------------------------------------------------------------------

export interface SecurityPrivacyReleaseCheckResult {
	checkedAt: string;
	packageName: string;
	packageVersion: string;
	profileId?: string | undefined;
	profileVersion?: string | undefined;
	dryRun: boolean;
	readOnly: true;
	status: SecurityPrivacyReleaseStatus;
	categorySummaries: SecurityPrivacyReleaseCategorySummary[];
	totalFindings: number;
	countsBySeverity: Record<SecurityPrivacyReleaseSeverity, number>;
	countsByCategory: Record<SecurityPrivacyReleaseCheckCategory, number>;
	findings: SecurityPrivacyReleaseFinding[];
	diagnostics: SecurityPrivacyReleaseDiagnostic[];
	redactionSummary: SecurityPrivacyReleaseRedactionResult;
	packageCheck?: SecurityPrivacyReleasePackageCheck | undefined;
	networkCheck?: SecurityPrivacyReleaseNetworkCheck | undefined;
	providerCheck?: SecurityPrivacyReleaseProviderCheck | undefined;
	artifactCheck?: SecurityPrivacyReleaseArtifactCheck | undefined;
	stateCheck?: SecurityPrivacyReleaseStateCheck | undefined;
	backupCheck?: SecurityPrivacyReleaseBackupCheck | undefined;
	logCheck?: SecurityPrivacyReleaseLogCheck | undefined;
	recommendedNextActions: string[];
	changedPaths: SecurityPrivacyReleaseChangedPath[];
}

// ---------------------------------------------------------------------------
// Report (human-readable overview)
// ---------------------------------------------------------------------------

export interface SecurityPrivacyReleaseCheckReport {
	result: SecurityPrivacyReleaseCheckResult;
	summaryLines: string[];
	findingLines: string[];
	recommendationLines: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function compareSecurityPrivacySeverity(
	a: SecurityPrivacyReleaseSeverity,
	b: SecurityPrivacyReleaseSeverity,
): number {
	return (
		SECURITY_PRIVACY_RELEASE_SEVERITY_ORDER[a] -
		SECURITY_PRIVACY_RELEASE_SEVERITY_ORDER[b]
	);
}

export function compareSecurityPrivacyCategory(
	a: SecurityPrivacyReleaseCheckCategory,
	b: SecurityPrivacyReleaseCheckCategory,
): number {
	return (
		SECURITY_PRIVACY_CHECK_CATEGORY_ORDER[a] -
		SECURITY_PRIVACY_CHECK_CATEGORY_ORDER[b]
	);
}

export function compareSecurityPrivacyFindingKind(
	a: SecurityPrivacyReleaseFindingKind,
	b: SecurityPrivacyReleaseFindingKind,
): number {
	return (
		SECURITY_PRIVACY_RELEASE_FINDING_KIND_ORDER[a] -
		SECURITY_PRIVACY_RELEASE_FINDING_KIND_ORDER[b]
	);
}

/**
 * Sort findings deterministically:
 * 1. severity (most severe first)
 * 2. category
 * 3. finding kind
 * 4. path
 * 5. id
 */
export function sortSecurityPrivacyReleaseFindings(
	findings: SecurityPrivacyReleaseFinding[],
): SecurityPrivacyReleaseFinding[] {
	return [...findings].sort((a, b) => {
		const sev = compareSecurityPrivacySeverity(a.severity, b.severity);
		if (sev !== 0) return sev;
		const cat = compareSecurityPrivacyCategory(a.category, b.category);
		if (cat !== 0) return cat;
		const kind = compareSecurityPrivacyFindingKind(a.kind, b.kind);
		if (kind !== 0) return kind;
		const pathA = a.path ?? '';
		const pathB = b.path ?? '';
		const pathCmp = pathA.localeCompare(pathB);
		if (pathCmp !== 0) return pathCmp;
		return a.id.localeCompare(b.id);
	});
}

/**
 * Determine release status from findings and strictness.
 */
export function determineSecurityPrivacyReleaseStatus(
	findings: SecurityPrivacyReleaseFinding[],
	options?: { strict?: boolean },
): SecurityPrivacyReleaseStatus {
	const hasFatal = findings.some((f) => f.severity === 'fatal');
	const hasError = findings.some((f) => f.severity === 'error');
	const hasWarning = findings.some((f) => f.severity === 'warning');

	if (hasFatal || hasError) return 'blocked';

	if (hasWarning) return 'pass_with_warnings';

	// In strict mode, check for missing evidence
	if (options?.strict) {
		const hasInsufficientEvidence = findings.some(
			(f) => f.kind === 'insufficient_security_evidence',
		);
		if (hasInsufficientEvidence) return 'unknown';
	}

	return 'pass';
}

/**
 * Build a finding ID.
 */
export function buildSecurityPrivacyReleaseFindingId(
	kind: SecurityPrivacyReleaseFindingKind,
	path?: string,
	counter?: number,
): string {
	const parts = [kind, path ?? '', String(counter ?? 0)];
	return parts.filter(Boolean).join('|');
}

/**
 * Create a redaction result summary.
 */
export function createRedactionResult(
	checkedCount: number,
	redactedCount: number,
	findingCount: number,
	categories: string[],
): SecurityPrivacyReleaseRedactionResult {
	const summary =
		redactedCount > 0
			? `Redacted ${redactedCount} secret-like value(s) across ${categories.length} categories.`
			: findingCount > 0
				? `${findingCount} redaction finding(s) detected but no direct secrets found.`
				: `No secret-like values detected across ${checkedCount} checked item(s).`;

	return {
		categories: [...categories].sort(),
		checkedCount,
		findingCount,
		redactedCount,
		summary,
	};
}
