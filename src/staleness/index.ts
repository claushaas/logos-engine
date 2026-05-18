/** Step 7.2 Staleness Detection — barrel exports */

export {
	computeArtifactMetadataFingerprint,
	computeDependencyGraphFingerprint,
	computeDocumentDescriptorFingerprint,
	computeGeneratedMetadataFingerprint,
	computeProfileContractFingerprint,
	computeRelevantStateFingerprint,
	computeStableFingerprint,
	computeStringFingerprint,
} from './source-fingerprint.js';
export { detectStaleness } from './staleness-detector.js';
export type { StalenessStatusSummary } from './staleness-status.js';
export { buildStalenessStatusSummary } from './staleness-status.js';
export type {
	ArtifactStalenessRecord,
	DocumentStalenessRecord,
	StalenessComparison,
	StalenessDependencyImpact,
	StalenessDetectionInput,
	StalenessDetectionOptions,
	StalenessDetectionResult,
	StalenessDiagnostic,
	StalenessFingerprint,
	StalenessReason,
	StalenessReasonCode,
	StalenessSeverity,
	StalenessSourceKind,
	StalenessStatus,
	StalenessSummary,
	StalenessTarget,
	StalenessTargetKind,
} from './staleness-types.js';
export {
	compareStalenessStatus,
	graphKindToStalenessTargetKind,
} from './staleness-types.js';
