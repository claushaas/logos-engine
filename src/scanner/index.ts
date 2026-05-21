/** Step 12.2 — Repository Scanner: barrel export */

export type {
	RepositoryScanArtifact,
	RepositoryScanArtifactKind,
	RepositoryScanBoundarySummary,
	RepositoryScanChangedPath,
	RepositoryScanCiSummary,
	RepositoryScanConfigSummary,
	RepositoryScanDiagnostic,
	RepositoryScanDocumentationSummary,
	RepositoryScanFinding,
	RepositoryScanFindingKind,
	RepositoryScanInput,
	RepositoryScanner,
	RepositoryScanOptions,
	RepositoryScanPackageSummary,
	RepositoryScanPolicy,
	RepositoryScanReport,
	RepositoryScanResult,
	RepositoryScanScope,
	RepositoryScanSecuritySummary,
	RepositoryScanSeverity,
	RepositoryScanSummary,
	RepositoryScanTarget,
	RepositoryScanTargetKind,
	RepositoryScanToolingSummary,
	RepositoryScanWorkspaceSummary,
} from './repository-scan-model.js';

export {
	buildScanReport,
	computeScanFindingCounts,
	computeScanSummary,
	createScanDiagnostic,
	createScanFinding,
	nextFindingId,
	resetFindingCounter,
	SCAN_ARTIFACT_KIND_ORDER,
	SCAN_FINDING_KIND_ORDER,
	SCAN_TARGET_KIND_ORDER,
	sortScanFindings,
} from './repository-scan-model.js';

export {
	checkFileCountLimit,
	checkFileSizeLimit,
	checkPathSafe,
	checkRecursionDepth,
	createPolicyLimitDiagnostic,
	isDirectoryIgnored,
	isExtensionAllowed,
	KNOWN_METADATA_FILENAMES,
	redactSecretContent,
	resolveScanPolicy,
	safeRelativePath,
	scanForSecrets,
} from './repository-scan-policy.js';
export type { ScannerFsAdapter } from './repository-scanner.js';
export { scanRepository } from './repository-scanner.js';
