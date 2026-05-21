/**
 * Release Candidate Package Smoke
 *
 * Step 13.4 — Package and Release Candidate Smoke
 */

export {
	checkPackageContents,
	getExpectedIncludedFiles,
	shouldExcludeFromPackage,
} from './package-contents.js';
export type {
	PackageContentsEntry,
	PackageContentsFinding,
	PackageContentsResult,
	PackageMetadataSummary,
	PackageSmokeCheck,
	PackageSmokeCheckKind,
	PackageSmokeDiagnostic,
	PackageSmokeInput,
	PackageSmokeOptions,
	PackageSmokeStatus,
	ReleaseCandidateChangedPath,
	ReleaseCandidateCommandSmokeResult,
	ReleaseCandidateSmokeResult,
} from './package-smoke-model.js';
export {
	BUNDLED_PROFILE_EXPECTED,
	BUNDLED_PROFILE_PHASE_EXPECTED,
	comparePackageSmokeCheckKind,
	comparePackageSmokeStatus,
	DIST_EXPECTED_FILES,
	PACKAGE_EXCLUDED_PATTERNS,
	PACKAGE_EXPECTED_FILES,
	PACKAGE_SENSITIVE_MARKERS,
	PACKAGE_SMOKE_CHECK_KIND_ORDER,
	PACKAGE_SMOKE_RECOVERY_HINTS,
	PACKAGE_SMOKE_STATUS_ORDER,
	REQUIRED_PACKAGE_FIELDS,
	REQUIRED_SCRIPTS,
	SMOKE_CLI_COMMANDS,
	sortPackageSmokeChecks,
	sortPackageSmokeDiagnostics,
} from './package-smoke-model.js';
export type { ReleaseCandidateSmokeReport } from './release-candidate-smoke.js';
export {
	buildReleaseCandidateSmokeReport,
	runReleaseCandidateSmoke,
} from './release-candidate-smoke.js';
