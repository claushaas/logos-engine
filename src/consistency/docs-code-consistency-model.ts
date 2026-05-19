/** Step 12.3 — Docs-vs-Code Consistency Checker: type contracts and model */

import type { RepositoryScanResult } from '../scanner/repository-scan-model.js';

// ---------------------------------------------------------------------------
// Severity
// ---------------------------------------------------------------------------

export type DocsCodeConsistencySeverity =
	| 'info'
	| 'warning'
	| 'error'
	| 'fatal';

// ---------------------------------------------------------------------------
// Comparison statuses
// ---------------------------------------------------------------------------

export type DocsCodeComparisonStatus =
	| 'consistent'
	| 'inconsistent'
	| 'missing_in_code'
	| 'missing_in_docs'
	| 'ambiguous'
	| 'unsupported'
	| 'unknown'
	| 'not_applicable';

// ---------------------------------------------------------------------------
// Claim kinds
// ---------------------------------------------------------------------------

export type DocsCodeClaimKind =
	| 'cli_command'
	| 'slash_command'
	| 'package_script'
	| 'package_binary'
	| 'node_version'
	| 'package_manager'
	| 'generated_root'
	| 'profile_id'
	| 'profile_registry'
	| 'phase_descriptor'
	| 'document_descriptor'
	| 'source_directory'
	| 'test_directory'
	| 'script_directory'
	| 'config_file'
	| 'ci_workflow'
	| 'canonical_output'
	| 'derived_artifact'
	| 'executive_export'
	| 'external_integration_boundary'
	| 'security_boundary'
	| 'provider_boundary'
	| 'unknown';

// ---------------------------------------------------------------------------
// Claim source types
// ---------------------------------------------------------------------------

export type DocsCodeClaimSource =
	| 'profile_registry'
	| 'phase_descriptor'
	| 'document_descriptor'
	| 'profile_contract'
	| 'package_json'
	| 'readme'
	| 'product_docs'
	| 'engineering_docs'
	| 'roadmap'
	| 'cli_metadata'
	| 'tui_metadata'
	| 'workspace_state'
	| 'fixture';

// ---------------------------------------------------------------------------
// Documentation claim
// ---------------------------------------------------------------------------

export interface DocsCodeClaim {
	id: string;
	kind: DocsCodeClaimKind;
	source: DocsCodeClaimSource;
	sourcePath?: string | undefined;
	sourcePointer?: string | undefined;
	/** What the documentation claims */
	claimedValue: string;
	/** Claim descriptor (e.g., script name, command name) */
	claimedKey?: string | undefined;
	/** Additional descriptor (e.g., flag name) */
	claimedSubKey?: string | undefined;
	/** Expected behavior modifier */
	expectedNonMutating?: boolean | undefined;
	expectedLocalOnly?: boolean | undefined;
	expectedNoProvider?: boolean | undefined;
	/** Whether the claim is essential/required */
	required: boolean;
	/** Human-readable claim description */
	description: string;
	/** Supporting snippet (bounded/redacted) */
	evidence?: string | undefined;
}

// ---------------------------------------------------------------------------
// Observed fact kinds
// ---------------------------------------------------------------------------

export type DocsCodeObservedFactKind =
	| 'observed_command'
	| 'observed_script'
	| 'observed_binary'
	| 'observed_config'
	| 'observed_directory'
	| 'observed_file'
	| 'observed_profile'
	| 'observed_output_path'
	| 'observed_artifact_metadata'
	| 'observed_security_marker'
	| 'observed_integration_marker'
	| 'missing_observation'
	| 'unknown';

// ---------------------------------------------------------------------------
// Observed fact
// ---------------------------------------------------------------------------

export interface DocsCodeObservedFact {
	id: string;
	kind: DocsCodeObservedFactKind;
	path?: string | undefined;
	key?: string | undefined;
	/** What was actually observed */
	observedValue: string;
	/** Whether the observation was bounded/limited */
	boundedObservation: boolean;
	/** Source of the observation */
	source:
		| 'scanner'
		| 'command_registry'
		| 'artifact_registry'
		| 'fixture'
		| 'inference';
	/** Scanner finding id if from scanner */
	scannerFindingId?: string | undefined;
	/** Whether observation was insufficient to determine */
	insufficient: boolean;
	/** Redacted marker if secret-like values were detected */
	redacted: boolean;
}

// ---------------------------------------------------------------------------
// Evidence for finding
// ---------------------------------------------------------------------------

export interface DocsCodeEvidence {
	claimId: string;
	claimKind: DocsCodeClaimKind;
	claimSource: DocsCodeClaimSource;
	observedFactId: string;
	observedFactKind: DocsCodeObservedFactKind;
	expectedValue: string;
	observedValue: string;
	summary: string;
}

// ---------------------------------------------------------------------------
// Recovery hint
// ---------------------------------------------------------------------------

export interface DocsCodeRecoveryHint {
	message: string;
	action?: string | undefined;
}

// ---------------------------------------------------------------------------
// Finding kinds
// ---------------------------------------------------------------------------

export type DocsCodeConsistencyFindingKind =
	| 'documented_command_missing'
	| 'implemented_command_undocumented'
	| 'documented_script_missing'
	| 'script_behavior_conflict'
	| 'package_binary_conflict'
	| 'version_contract_conflict'
	| 'generated_root_conflict'
	| 'profile_identity_conflict'
	| 'profile_descriptor_conflict'
	| 'document_descriptor_conflict'
	| 'source_tree_conflict'
	| 'test_tree_conflict'
	| 'config_contract_conflict'
	| 'ci_contract_conflict'
	| 'canonical_output_conflict'
	| 'derived_artifact_boundary_conflict'
	| 'executive_export_boundary_conflict'
	| 'external_integration_boundary_conflict'
	| 'provider_boundary_conflict'
	| 'security_boundary_conflict'
	| 'readme_drift'
	| 'unsupported_claim'
	| 'insufficient_observation'
	| 'unknown_conflict';

// ---------------------------------------------------------------------------
// Consistency finding
// ---------------------------------------------------------------------------

export interface DocsCodeConsistencyFinding {
	id: string;
	kind: DocsCodeConsistencyFindingKind;
	severity: DocsCodeConsistencySeverity;
	claimId?: string | undefined;
	observedFactId?: string | undefined;
	comparisonStatus: DocsCodeComparisonStatus;
	claimSourcePath?: string | undefined;
	claimSourcePointer?: string | undefined;
	observedPath?: string | undefined;
	observedKey?: string | undefined;
	expectedValue: string;
	observedValue: string;
	evidence: DocsCodeEvidence;
	recoveryHint: DocsCodeRecoveryHint;
	order: number;
}

// ---------------------------------------------------------------------------
// Comparison
// ---------------------------------------------------------------------------

export interface DocsCodeComparison {
	id: string;
	claimId: string;
	observedFactId: string;
	status: DocsCodeComparisonStatus;
	findingId?: string | undefined;
}

// ---------------------------------------------------------------------------
// Specialized check types
// ---------------------------------------------------------------------------

export interface DocsCodeCommandCheck {
	commandName: string;
	commandKind: 'cli_command' | 'slash_command';
	flags?: string[] | undefined;
	claimId: string;
	observedFactId?: string | undefined;
	expectedPresent: boolean;
	observedPresent: boolean;
}

export interface DocsCodeScriptCheck {
	scriptName: string;
	claimId: string;
	observedFactId?: string | undefined;
	expectedPresent: boolean;
	observedPresent: boolean;
	expectedNonMutating: boolean;
	observedMutating: boolean;
	scriptCommand?: string | undefined;
}

export interface DocsCodeRootCheck {
	documentedRoot: string;
	configuredRoot: string | null;
	observedRoot: string | null;
	claimId: string;
	observedFactId?: string | undefined;
}

export interface DocsCodeProfileCheck {
	activeProfileId: string | null;
	documentedProfileId: string | null;
	claimId: string;
	observedFactId?: string | undefined;
}

export interface DocsCodeArtifactBoundaryCheck {
	artifactPath: string;
	artifactType: string;
	claimedAsCanonical: boolean;
	observedIsCanonical: boolean;
	claimId: string;
	observedFactId?: string | undefined;
}

export interface DocsCodeSecurityCheck {
	secretLikeCount: number;
	envVarReferencesOnly: boolean;
	noNetworkScriptsInCheck: boolean;
	noProviderCredsRequired: boolean;
	claimId: string;
	observedFactId?: string | undefined;
}

export interface DocsCodeBoundaryCheck {
	checkType:
		| 'canonical_boundary'
		| 'derived_boundary'
		| 'executive_boundary'
		| 'integration_boundary'
		| 'provider_boundary';
	claimedBoundary: string;
	observedBoundary: string;
	claimId: string;
	observedFactId?: string | undefined;
}

// ---------------------------------------------------------------------------
// Changed path (always empty for read-only checker)
// ---------------------------------------------------------------------------

export interface DocsCodeChangedPath {
	readonly _empty: true;
}

// ---------------------------------------------------------------------------
// Summary by category
// ---------------------------------------------------------------------------

export interface DocsCodeCategorySummary {
	category: string;
	consistentCount: number;
	inconsistentCount: number;
	missingInCodeCount: number;
	missingInDocsCount: number;
	ambiguousCount: number;
	unsupportedCount: number;
	unknownCount: number;
	totalFindings: number;
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

export interface DocsCodeConsistencySummary {
	claimCount: number;
	observedFactCount: number;
	comparisonCount: number;
	consistentCount: number;
	inconsistentCount: number;
	missingInCodeCount: number;
	missingInDocsCount: number;
	ambiguousCount: number;
	unsupportedCount: number;
	unknownCount: number;
	findingCounts: {
		fatal: number;
		error: number;
		warning: number;
		info: number;
		total: number;
	};
	categories: Record<string, DocsCodeCategorySummary>;
}

// ---------------------------------------------------------------------------
// Diagnostics
// ---------------------------------------------------------------------------

export interface DocsCodeConsistencyDiagnostic {
	code: string;
	severity: DocsCodeConsistencySeverity;
	message: string;
	sourcePath?: string | undefined;
	pointer?: string | undefined;
	claimId?: string | undefined;
	observedFactId?: string | undefined;
	findingId?: string | undefined;
	expected?: unknown;
	received?: unknown;
	recoveryHint?: string | undefined;
}

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

export interface DocsCodeConsistencyInput {
	/** Profile ID (e.g., 'standard') */
	profileId: string;
	/** Profile version if available */
	profileVersion?: string | undefined;
	/** Documentation root (defaults to 'logos/') */
	documentationRoot?: string | undefined;
	/** Project root path */
	projectRoot: string;
	/** Repository scanner result from Step 12.2 */
	scannerResult?: RepositoryScanResult | undefined;
	/** Explicit documentation claims (for tests/fixtures) */
	claims?: DocsCodeClaim[] | undefined;
	/** Observed facts (for tests/fixtures) */
	observedFacts?: DocsCodeObservedFact[] | undefined;
	/** Optional artifact registry metadata */
	artifactRegistryEntries?:
		| Array<{
				artifactId: string;
				artifactType: string;
				isCanonical?: boolean | undefined;
				path: string;
				status?: string | undefined;
				metadata?: Record<string, unknown> | undefined;
		  }>
		| undefined;
	/** Optional command registry metadata */
	commandRegistry?:
		| {
				externalCommands: string[];
				slashCommands: string[];
		  }
		| undefined;
	/** Optional existing validation findings */
	existingValidationFindings?:
		| Array<{
				id: string;
				code: string;
				severity: string;
				message: string;
		  }>
		| undefined;
	/** Injected clock timestamp (ISO 8601) */
	checkedAt?: string | undefined;
	/** Dry-run marker */
	dryRun?: boolean | undefined;
	/** Package.json content snippet (bounded, metadata only) */
	packageMetadata?:
		| {
				name?: string | undefined;
				version?: string | undefined;
				bin?: Record<string, string> | undefined;
				scripts?: Record<string, string> | undefined;
				engines?: Record<string, string> | undefined;
				packageManager?: string | undefined;
		  }
		| undefined;
	/** README content snippet for drift detection */
	readmeSnippet?: string | undefined;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface DocsCodeConsistencyOptions {
	includeInfo?: boolean | undefined;
	dryRun?: boolean;
	idFactory?: (() => string) | undefined;
}

// ---------------------------------------------------------------------------
// Result
// ---------------------------------------------------------------------------

export interface DocsCodeConsistencyResult {
	activeProfileId: string | null;
	profileVersion: string | null;
	documentationRoot: string;
	checkedAt: string;
	dryRun: boolean;
	readOnly: true;
	claimCount: number;
	observedFactCount: number;
	comparisonCount: number;
	consistentCount: number;
	inconsistentCount: number;
	missingInCodeCount: number;
	missingInDocsCount: number;
	ambiguousCount: number;
	unsupportedCount: number;
	unknownCount: number;
	findings: DocsCodeConsistencyFinding[];
	comparisons: DocsCodeComparison[];
	diagnostics: DocsCodeConsistencyDiagnostic[];
	summaries: Record<string, DocsCodeCategorySummary>;
	changedPaths: [];
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

export interface DocsCodeConsistencyReport {
	summary: DocsCodeConsistencySummary;
	scopeAndPolicyNote: string;
	claimsChecked: {
		total: number;
		byKind: Record<string, number>;
		bySource: Record<string, number>;
	};
	observedFactsUsed: {
		total: number;
		byKind: Record<string, number>;
		bySource: Record<string, number>;
	};
	commandConsistency: {
		consistent: string[];
		inconsistent: string[];
		missingInCode: string[];
		missingInDocs: string[];
		unknown: string[];
	};
	packageScriptConsistency: {
		consistent: string[];
		inconsistent: string[];
		missingInCode: string[];
		unknown: string[];
	};
	rootProfileConsistency: {
		configuredRoot: string | null;
		documentedRoot: string;
		activeProfileId: string | null;
		profileIssues: string[];
	};
	structureConfigConsistency: {
		expected: string[];
		observed: string[];
		missing: string[];
		extra: string[];
	};
	canonicalOutputConsistency: {
		consistent: string[];
		conflicts: string[];
	};
	derivedArtifactBoundaryConsistency: {
		consistent: string[];
		conflicts: string[];
	};
	executiveExportBoundaryConsistency: {
		consistent: string[];
		conflicts: string[];
	};
	externalIntegrationProviderSecurityConsistency: {
		consistent: string[];
		conflicts: string[];
	};
	findingsBySeverity: {
		fatal: string[];
		error: string[];
		warning: string[];
		info: string[];
	};
	unknownObservations: string[];
	recommendedNextActions: string[];
	boundedDisclaimer: string;
}

// ---------------------------------------------------------------------------
// Checker type
// ---------------------------------------------------------------------------

export type DocsCodeConsistencyChecker = (
	input: DocsCodeConsistencyInput,
	options?: DocsCodeConsistencyOptions,
) => DocsCodeConsistencyResult;

// ---------------------------------------------------------------------------
// Severity ordering
// ---------------------------------------------------------------------------

const SEVERITY_VALUE: Record<DocsCodeConsistencySeverity, number> = {
	error: 1,
	fatal: 0,
	info: 3,
	warning: 2,
};

export function compareSeverity(
	a: DocsCodeConsistencySeverity,
	b: DocsCodeConsistencySeverity,
): number {
	return (SEVERITY_VALUE[a] ?? 99) - (SEVERITY_VALUE[b] ?? 99);
}

// ---------------------------------------------------------------------------
// Finding kind ordering
// ---------------------------------------------------------------------------

const FINDING_KIND_ORDER: Record<DocsCodeConsistencyFindingKind, number> = {
	canonical_output_conflict: 10,
	ci_contract_conflict: 11,
	config_contract_conflict: 9,
	derived_artifact_boundary_conflict: 14,
	document_descriptor_conflict: 8,
	documented_command_missing: 0,
	documented_script_missing: 3,
	executive_export_boundary_conflict: 15,
	external_integration_boundary_conflict: 16,
	generated_root_conflict: 5,
	implemented_command_undocumented: 1,
	insufficient_observation: 21,
	package_binary_conflict: 4,
	profile_descriptor_conflict: 7,
	profile_identity_conflict: 6,
	provider_boundary_conflict: 17,
	readme_drift: 20,
	script_behavior_conflict: 2,
	security_boundary_conflict: 18,
	source_tree_conflict: 12,
	test_tree_conflict: 13,
	unknown_conflict: 23,
	unsupported_claim: 22,
	version_contract_conflict: 19,
};

// ---------------------------------------------------------------------------
// Finding category mapping
// ---------------------------------------------------------------------------

export function findingKindToCategory(
	kind: DocsCodeConsistencyFindingKind,
): string {
	if (
		kind === 'documented_command_missing' ||
		kind === 'implemented_command_undocumented'
	) {
		return 'commands';
	}
	if (
		kind === 'documented_script_missing' ||
		kind === 'script_behavior_conflict' ||
		kind === 'package_binary_conflict' ||
		kind === 'version_contract_conflict'
	) {
		return 'scripts';
	}
	if (kind === 'generated_root_conflict') {
		return 'roots';
	}
	if (
		kind === 'profile_identity_conflict' ||
		kind === 'profile_descriptor_conflict' ||
		kind === 'document_descriptor_conflict'
	) {
		return 'profile';
	}
	if (kind === 'source_tree_conflict' || kind === 'test_tree_conflict') {
		return 'structure';
	}
	if (kind === 'config_contract_conflict' || kind === 'ci_contract_conflict') {
		return 'configs';
	}
	if (kind === 'canonical_output_conflict') {
		return 'canonical outputs';
	}
	if (kind === 'derived_artifact_boundary_conflict') {
		return 'derived boundaries';
	}
	if (kind === 'executive_export_boundary_conflict') {
		return 'executive exports';
	}
	if (
		kind === 'external_integration_boundary_conflict' ||
		kind === 'provider_boundary_conflict' ||
		kind === 'security_boundary_conflict'
	) {
		return 'external integration/provider/security boundaries';
	}
	return 'other';
}

// ---------------------------------------------------------------------------
// Sorting
// ---------------------------------------------------------------------------

export function sortDocsCodeFindings(
	findings: DocsCodeConsistencyFinding[],
): DocsCodeConsistencyFinding[] {
	return [...findings]
		.sort((a, b) => {
			// 1. Severity
			const sev = compareSeverity(a.severity, b.severity);
			if (sev !== 0) return sev;

			// 2. Finding kind
			const kindDiff =
				(FINDING_KIND_ORDER[a.kind] ?? 99) - (FINDING_KIND_ORDER[b.kind] ?? 99);
			if (kindDiff !== 0) return kindDiff;

			// 3. Claim kind via claimSourcePath
			const pathDiff = (a.claimSourcePath ?? '').localeCompare(
				b.claimSourcePath ?? '',
			);
			if (pathDiff !== 0) return pathDiff;

			// 4. Observed path/key
			const obsDiff = (a.observedPath ?? '').localeCompare(
				b.observedPath ?? '',
			);
			if (obsDiff !== 0) return obsDiff;

			// 5. Stable finding id
			return a.id.localeCompare(b.id);
		})
		.map((finding, index) => ({ ...finding, order: index }));
}

// ---------------------------------------------------------------------------
// ID factory
// ---------------------------------------------------------------------------

let _idCounter = 0;

export function resetDocsCodeIdCounter(start?: number): void {
	_idCounter = start ?? 0;
}

export function nextDocsCodeId(prefix: string): string {
	_idCounter += 1;
	return `${prefix}-${_idCounter}`;
}
