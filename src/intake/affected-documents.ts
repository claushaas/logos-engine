/** Affected Documents Resolver — compute impacted documents from proposals, decisions, and dependency graph */

import type { WorkspaceState } from '../state/workspace-state.schema.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AffectedDocumentsInput {
	/** Direct affected document IDs */
	affectedDocumentIds: string[];
	/** Source document canonical ID if available */
	sourceDocumentCanonicalId?: string | undefined;
	/** Workspace state for artifact lookup */
	state: WorkspaceState;
}

export interface AffectedDocumentsResult {
	/** Directly affected canonical document IDs */
	directDocumentIds: string[];
	/** Artifact IDs that reference the affected documents */
	affectedArtifactIds: string[];
	/** Artifact paths that are considered stale */
	staleArtifactPaths: string[];
	/** Confidence of the resolution */
	confidence: 'high' | 'medium' | 'low' | 'unknown';
	/** Diagnostic messages */
	diagnostics: AffectedDocumentsDiagnostic[];
}

export interface AffectedDocumentsDiagnostic {
	code: string;
	severity: 'error' | 'warning' | 'info';
	message: string;
	recoveryHint?: string | undefined;
}

// ---------------------------------------------------------------------------
// Mark artifacts stale in workspace state
// ---------------------------------------------------------------------------

export interface MarkArtifactsStaleInput {
	affectedDocumentIds: string[];
	dryRun?: boolean;
}

/**
 * Returns an updater function that marks affected artifacts as stale.
 * Use with updateWorkspaceState().
 */
export function markArtifactsStaleUpdater(
	input: MarkArtifactsStaleInput,
): (state: WorkspaceState) => WorkspaceState {
	return (state: WorkspaceState) => {
		const updated = structuredClone(state);
		updated.artifacts = updated.artifacts.map((a) => {
			if (
				a.sourceDocumentIds.some((id) => input.affectedDocumentIds.includes(id))
			) {
				return { ...a, status: 'stale' as const };
			}
			return a;
		});
		return updated;
	};
}

// ---------------------------------------------------------------------------
// Resolve affected documents
// ---------------------------------------------------------------------------

export function resolveAffectedDocuments(
	input: AffectedDocumentsInput,
): AffectedDocumentsResult {
	const directDocumentIds = [...input.affectedDocumentIds];
	const diagnostics: AffectedDocumentsDiagnostic[] = [];
	const affectedArtifactIds: string[] = [];
	const staleArtifactPaths: string[] = [];

	// Add source document if available and not already included
	if (
		input.sourceDocumentCanonicalId &&
		!directDocumentIds.includes(input.sourceDocumentCanonicalId)
	) {
		directDocumentIds.push(input.sourceDocumentCanonicalId);
	}

	// Find artifacts that reference the affected documents
	for (const artifact of input.state.artifacts) {
		if (
			artifact.sourceDocumentIds.some((id) => directDocumentIds.includes(id))
		) {
			affectedArtifactIds.push(artifact.artifactId);
			staleArtifactPaths.push(artifact.path);
		}
	}

	// Also include artifacts that are already stale
	for (const artifact of input.state.artifacts) {
		if (
			artifact.status === 'stale' &&
			!affectedArtifactIds.includes(artifact.artifactId)
		) {
			staleArtifactPaths.push(artifact.path);
		}
	}

	let confidence: AffectedDocumentsResult['confidence'] = 'medium';

	if (directDocumentIds.length === 0) {
		confidence = 'unknown';
		diagnostics.push({
			code: 'LOGOS_AFFECTED_DOCUMENTS_UNKNOWN',
			message:
				'No affected documents could be determined. Run /diagnose or /validate for comprehensive impact analysis.',
			recoveryHint:
				'Manually review the dependency graph with /graph to assess impact.',
			severity: 'warning',
		});
	}

	if (affectedArtifactIds.length > 0 && directDocumentIds.length > 0) {
		confidence = 'high';
	}

	return {
		affectedArtifactIds,
		confidence,
		diagnostics,
		directDocumentIds,
		staleArtifactPaths,
	};
}
