/** Step 12.1 — Import conflict detection: collisions, duplicates, and boundary violations */

import type { DocumentationContract } from '../profiles/documentation-contract.js';
import type {
	DocumentationImportBlocker,
	DocumentationImportCandidate,
	DocumentationImportConflict,
	DocumentationImportDiagnostic,
	DocumentationImportMapping,
	DocumentationImportWarning,
} from './import-model.js';
import {
	contentLooksLikeDerivedArtifact,
	pathLooksLikeDerivedArtifact,
} from './import-model.js';

// ---------------------------------------------------------------------------
// Conflict detection input
// ---------------------------------------------------------------------------

export interface ImportConflictDetectionInput {
	candidates: DocumentationImportCandidate[];
	mappings: DocumentationImportMapping[];
	documentationContract?: DocumentationContract | undefined;
	existingCanonicalOutputs?: string[] | undefined;
	documentationRoot: string;
	projectRoot?: string | undefined;
	manualEditStatuses?: Map<string, boolean> | undefined;
}

export interface ImportConflictDetectionResult {
	conflicts: DocumentationImportConflict[];
	blockers: DocumentationImportBlocker[];
	warnings: DocumentationImportWarning[];
	diagnostics: DocumentationImportDiagnostic[];
}

// ---------------------------------------------------------------------------
// Main conflict detection
// ---------------------------------------------------------------------------

let conflictIdCounter = 0;

function nextConflictId(): string {
	conflictIdCounter++;
	return `import-conflict-${conflictIdCounter}`;
}

/**
 * Reset the conflict ID counter (for deterministic test runs).
 */
export function resetConflictIdCounter(): void {
	conflictIdCounter = 0;
}

/**
 * Detect conflicts among import candidates, existing canonical outputs,
 * and profile contracts.
 *
 * This is read-only and does not modify any files or state.
 */
export function detectImportConflicts(
	input: ImportConflictDetectionInput,
): ImportConflictDetectionResult {
	const conflicts: DocumentationImportConflict[] = [];
	const blockers: DocumentationImportBlocker[] = [];
	const warnings: DocumentationImportWarning[] = [];
	const diagnostics: DocumentationImportDiagnostic[] = [];

	// 1. Check for existing canonical output collisions
	if (
		input.existingCanonicalOutputs &&
		input.existingCanonicalOutputs.length > 0
	) {
		detectExistingOutputCollisions(
			input.candidates,
			input.existingCanonicalOutputs,
			conflicts,
			diagnostics,
			warnings,
		);
	}

	// 2. Check for multiple candidates mapping to same document
	detectMultipleCandidateConflicts(
		input.candidates,
		input.mappings,
		conflicts,
		diagnostics,
	);

	// 3. Check for candidates mapping to multiple documents
	detectMultiMappingConflicts(
		input.candidates,
		input.mappings,
		conflicts,
		diagnostics,
	);

	// 4. Check for derived artifacts being treated as canonical sources
	detectDerivedArtifactConflicts(
		input.candidates,
		conflicts,
		diagnostics,
		warnings,
	);

	// 5. Check for profile/schema mismatch
	if (input.documentationContract) {
		detectProfileMismatchConflicts(
			input.candidates,
			input.documentationContract,
			conflicts,
			diagnostics,
		);
	}

	// 6. Check for manual edit collisions
	if (input.manualEditStatuses && input.manualEditStatuses.size > 0) {
		detectManualEditCollisions(
			input.candidates,
			input.mappings,
			input.manualEditStatuses,
			input.documentationRoot,
			conflicts,
			diagnostics,
		);
	}

	// 7. Check for secret/sensitive content
	detectSecretContentConflicts(
		input.candidates,
		conflicts,
		blockers,
		diagnostics,
	);

	// 8. Check for unsafe paths
	detectUnsafePathConflicts(input.candidates, conflicts, blockers, diagnostics);

	return { blockers, conflicts, diagnostics, warnings };
}

// ---------------------------------------------------------------------------
// Existing canonical output collisions
// ---------------------------------------------------------------------------

function detectExistingOutputCollisions(
	candidates: DocumentationImportCandidate[],
	existingOutputs: string[],
	_conflicts: DocumentationImportConflict[],
	diagnostics: DocumentationImportDiagnostic[],
	warnings: DocumentationImportWarning[],
): void {
	const existingOutputSet = new Set(existingOutputs);

	for (const candidate of candidates) {
		const candidatePath = candidate.relativePath;

		if (existingOutputSet.has(candidatePath)) {
			// The candidate is the same file as an existing canonical output
			diagnostics.push({
				candidateId: candidate.id,
				candidateKind: candidate.kind,
				code: 'import_candidate_is_existing_canonical',
				message: `Candidate "${candidatePath}" appears to be an existing canonical output`,
				severity: 'info',
				sourcePath: candidatePath,
			});
			warnings.push({
				candidateId: candidate.id,
				code: 'import_possible_existing_canonical',
				message: `Candidate is the same path as an existing canonical output: "${candidatePath}"`,
				sourcePath: candidatePath,
			});
		}
	}
}

// ---------------------------------------------------------------------------
// Multiple candidates → same document
// ---------------------------------------------------------------------------

function detectMultipleCandidateConflicts(
	_candidates: DocumentationImportCandidate[],
	mappings: DocumentationImportMapping[],
	conflicts: DocumentationImportConflict[],
	diagnostics: DocumentationImportDiagnostic[],
): void {
	// Group mappings by target document canonical ID
	const byTarget = new Map<string, DocumentationImportMapping[]>();
	for (const m of mappings) {
		if (m.targetDocumentCanonicalId && m.status !== 'not_applicable') {
			const existing = byTarget.get(m.targetDocumentCanonicalId) ?? [];
			existing.push(m);
			byTarget.set(m.targetDocumentCanonicalId, existing);
		}
	}

	for (const [targetId, mappingList] of byTarget.entries()) {
		if (mappingList.length > 1) {
			const candidateIds = [...new Set(mappingList.map((m) => m.candidateId))];
			conflicts.push({
				candidateIds,
				id: nextConflictId(),
				kind: 'multiple_candidates_same_document',
				message: `Multiple candidates (${candidateIds.join(', ')}) map to document "${targetId}"`,
				severity: 'error',
				targetDocumentId: targetId,
			});

			diagnostics.push({
				candidateId: candidateIds[0],
				code: 'import_multiple_candidates_same_document',
				message: `Multiple candidates compete for the same target document`,
				severity: 'error',
				targetDocumentId: targetId,
			});
		}
	}
}

// ---------------------------------------------------------------------------
// Candidate → multiple documents
// ---------------------------------------------------------------------------

function detectMultiMappingConflicts(
	_candidates: DocumentationImportCandidate[],
	mappings: DocumentationImportMapping[],
	conflicts: DocumentationImportConflict[],
	diagnostics: DocumentationImportDiagnostic[],
): void {
	// Group mappings by candidate ID
	const byCandidate = new Map<string, DocumentationImportMapping[]>();
	for (const m of mappings) {
		if (m.status !== 'not_applicable' && m.targetDocumentCanonicalId) {
			const existing = byCandidate.get(m.candidateId) ?? [];
			existing.push(m);
			byCandidate.set(m.candidateId, existing);
		}
	}

	for (const [candidateId, mappingList] of byCandidate.entries()) {
		if (mappingList.length > 1) {
			// Check if it's actually the ambiguous case (same score band) or a real conflict
			const uniqueTargets = new Set(
				mappingList.map((m) => m.targetDocumentCanonicalId),
			);

			if (uniqueTargets.size > 1) {
				conflicts.push({
					candidateIds: [candidateId],
					id: nextConflictId(),
					kind: 'candidate_maps_to_multiple_documents',
					message: `Candidate "${candidateId}" maps to multiple documents: ${[...uniqueTargets].join(', ')}`,
					severity: 'warning',
				});

				diagnostics.push({
					candidateId,
					code: 'import_candidate_maps_to_multiple',
					message: `Candidate maps to multiple target documents`,
					severity: 'warning',
				});
			}
		}
	}
}

// ---------------------------------------------------------------------------
// Derived artifact → canonical source
// ---------------------------------------------------------------------------

function detectDerivedArtifactConflicts(
	candidates: DocumentationImportCandidate[],
	conflicts: DocumentationImportConflict[],
	diagnostics: DocumentationImportDiagnostic[],
	_warnings: DocumentationImportWarning[],
): void {
	for (const candidate of candidates) {
		const isDerivedPath = pathLooksLikeDerivedArtifact(candidate.relativePath);
		const isDerivedContent =
			candidate.contentSnippet &&
			contentLooksLikeDerivedArtifact(candidate.contentSnippet);

		if (isDerivedPath || isDerivedContent) {
			const conflict: DocumentationImportConflict = {
				candidateIds: [candidate.id],
				id: nextConflictId(),
				kind: 'derived_artifact_as_source',
				message: `Candidate "${candidate.relativePath}" appears to be a derived artifact and should not be imported as a canonical source`,
				recoveryHint:
					'Derived artifacts are regenerated from canonical sources',
				severity: 'warning',
				sourcePath: candidate.relativePath,
			};
			conflicts.push(conflict);

			diagnostics.push({
				candidateId: candidate.id,
				candidateKind: candidate.kind,
				code: 'import_derived_as_source',
				message: `Derived artifact detected as import candidate`,
				severity: 'warning',
				sourcePath: candidate.relativePath,
			});
		}
	}
}

// ---------------------------------------------------------------------------
// Profile/schema mismatch
// ---------------------------------------------------------------------------

function detectProfileMismatchConflicts(
	candidates: DocumentationImportCandidate[],
	contract: DocumentationContract,
	conflicts: DocumentationImportConflict[],
	diagnostics: DocumentationImportDiagnostic[],
): void {
	for (const candidate of candidates) {
		const declaredProfile = candidate.metadata.declaredProfileId;

		if (declaredProfile && declaredProfile !== contract.profileId) {
			conflicts.push({
				candidateIds: [candidate.id],
				id: nextConflictId(),
				kind: 'profile_mismatch',
				message: `Candidate "${candidate.relativePath}" declares profile "${declaredProfile}" but active profile is "${contract.profileId}"`,
				severity: 'error',
				sourcePath: candidate.relativePath,
			});

			diagnostics.push({
				candidateId: candidate.id,
				code: 'import_profile_mismatch',
				expected: contract.profileId,
				message: `Profile mismatch: candidate=${declaredProfile}, active=${contract.profileId}`,
				received: declaredProfile,
				recoveryHint: 'Import as reference only or update profile mapping',
				severity: 'error',
				sourcePath: candidate.relativePath,
			});
		}

		// Check for descriptor candidates with possible schema mismatches
		if (
			candidate.kind === 'document_descriptor' ||
			candidate.kind === 'phase_descriptor'
		) {
			diagnostics.push({
				candidateId: candidate.id,
				candidateKind: candidate.kind,
				code: 'import_descriptor_schema_review',
				message: `Descriptor candidate requires schema validation before importing`,
				recoveryHint: 'Validate descriptor schema against active profile',
				severity: 'warning',
				sourcePath: candidate.relativePath,
			});
		}
	}
}

// ---------------------------------------------------------------------------
// Manual edit collisions
// ---------------------------------------------------------------------------

function detectManualEditCollisions(
	candidates: DocumentationImportCandidate[],
	mappings: DocumentationImportMapping[],
	manualEditStatuses: Map<string, boolean>,
	_documentationRoot: string,
	conflicts: DocumentationImportConflict[],
	diagnostics: DocumentationImportDiagnostic[],
): void {
	for (const mapping of mappings) {
		if (!mapping.targetDocumentCanonicalId) continue;

		const candidate = candidates.find((c) => c.id === mapping.candidateId);
		if (!candidate) continue;

		// Check if the target document's canonical output has manual edits
		for (const [path, hasEdits] of manualEditStatuses.entries()) {
			if (hasEdits && path.includes(mapping.targetDocumentCanonicalId)) {
				conflicts.push({
					candidateIds: [candidate.id],
					id: nextConflictId(),
					kind: 'manual_edit_collision',
					message: `Target document "${mapping.targetDocumentCanonicalId}" has manual edits that may conflict with import`,
					recoveryHint: 'Review manual edits before importing over them',
					severity: 'warning',
					sourcePath: candidate.relativePath,
					targetDocumentId: mapping.targetDocumentCanonicalId,
				});

				diagnostics.push({
					candidateId: candidate.id,
					code: 'import_manual_edit_collision',
					message: `Manual edit collision detected for target document`,
					severity: 'warning',
					sourcePath: candidate.relativePath,
					targetDocumentId: mapping.targetDocumentCanonicalId,
				});
			}
		}
	}
}

// ---------------------------------------------------------------------------
// Secret/sensitive content detection
// ---------------------------------------------------------------------------

function detectSecretContentConflicts(
	candidates: DocumentationImportCandidate[],
	conflicts: DocumentationImportConflict[],
	_blockers: DocumentationImportBlocker[],
	diagnostics: DocumentationImportDiagnostic[],
): void {
	for (const candidate of candidates) {
		if (candidate.status === 'unsafe') {
			conflicts.push({
				candidateIds: [candidate.id],
				id: nextConflictId(),
				kind: 'secret_or_sensitive_content',
				message: `Candidate "${candidate.relativePath}" contains secret-like content`,
				recoveryHint: 'Redact secrets from the file before importing',
				severity: 'error',
				sourcePath: candidate.relativePath,
			});

			diagnostics.push({
				candidateId: candidate.id,
				code: 'import_secret_content',
				message: `Secret-like content was detected and will be redacted in diagnostics`,
				severity: 'error',
				sourcePath: candidate.relativePath,
			});
		}
	}
}

// ---------------------------------------------------------------------------
// Unsafe path detection
// ---------------------------------------------------------------------------

function detectUnsafePathConflicts(
	candidates: DocumentationImportCandidate[],
	conflicts: DocumentationImportConflict[],
	blockers: DocumentationImportBlocker[],
	diagnostics: DocumentationImportDiagnostic[],
): void {
	for (const candidate of candidates) {
		if (
			candidate.relativePath.includes('..') ||
			candidate.relativePath.startsWith('/')
		) {
			conflicts.push({
				candidateIds: [candidate.id],
				id: nextConflictId(),
				kind: 'unsafe_path',
				message: `Candidate "${candidate.relativePath}" has an unsafe path`,
				severity: 'error',
				sourcePath: candidate.relativePath,
			});

			blockers.push({
				candidateId: candidate.id,
				code: 'import_unsafe_path',
				message: `Unsafe path detected: "${candidate.relativePath}"`,
				severity: 'error',
				sourcePath: candidate.relativePath,
			});

			diagnostics.push({
				candidateId: candidate.id,
				candidateKind: candidate.kind,
				code: 'import_unsafe_path',
				message: `Unsafe path detected in import candidate`,
				severity: 'error',
				sourcePath: candidate.relativePath,
			});
		}
	}
}
