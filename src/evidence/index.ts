/**
 * NFR Evidence — public API for Phase 8: NFR Evidence And Release Hardening.
 *
 * Exports the evidence model, runner, and category-specific evidence modules
 * for use by tests, scripts, and documentation.
 */

export {
	type AccessibilityEvidenceOptions,
	runAccessibilityEvidence,
} from './accessibility-evidence.js';
export {
	type CompatibilityEvidenceOptions,
	runCompatibilityEvidence,
} from './compatibility-evidence.js';
export {
	type HtmlAccessibilityEvidenceOptions,
	runHtmlAccessibilityEvidence,
} from './html-accessibility-evidence.js';
// Model
export {
	compareNfrEvidenceItem,
	createNfrEvidenceEnvironment,
	createNfrEvidenceItem,
	createNfrEvidenceReport,
	NFR_EVIDENCE_CATEGORIES,
	NFR_EVIDENCE_CATEGORY_ORDER,
	NFR_EVIDENCE_STATUS_ORDER,
	type NfrEvidenceCategory,
	type NfrEvidenceDiagnostic,
	type NfrEvidenceEnvironment,
	type NfrEvidenceExpectation,
	type NfrEvidenceItem,
	type NfrEvidenceReport,
	type NfrEvidenceSourceKind,
	type NfrEvidenceStatus,
	nfrEvidenceDiagnostic,
	rollupNfrEvidenceStatus,
	sortNfrEvidenceItems,
} from './nfr-evidence-model.js';
// Runner
export {
	type NfrEvidenceRunnerOptions,
	runNfrEvidence,
} from './nfr-evidence-runner.js';
// Category modules
export {
	type PerformanceEvidenceOptions,
	runPerformanceEvidence,
} from './performance-evidence.js';
export {
	type PrivacySecurityEvidenceOptions,
	runPrivacySecurityEvidence,
} from './privacy-security-evidence.js';
export {
	type ProviderTimeoutEvidenceOptions,
	runProviderTimeoutEvidence,
} from './provider-timeout-evidence.js';
export {
	type ReleaseGateEvidenceOptions,
	runReleaseGateEvidence,
} from './release-gate.js';
export {
	type ReliabilityRecoveryEvidenceOptions,
	runReliabilityRecoveryEvidence,
} from './reliability-recovery-evidence.js';
export {
	runScalabilityEvidence,
	type ScalabilityEvidenceOptions,
} from './scalability-evidence.js';
