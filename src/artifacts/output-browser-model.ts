/**
 * Output Browser Model — Phase 7: Derived Artifact Generation And Browsing
 *
 * Pure types, filter contracts, and display helpers for the output browser.
 * Read-only: no state mutation, no filesystem, no providers.
 */

import type { WorkspaceArtifact } from '../state/workspace-state.schema.js';

// ---------------------------------------------------------------------------
// Display kind — normalizes artifact type into a user-facing label
// ---------------------------------------------------------------------------

export type OutputDisplayKind =
	| 'canonical_markdown'
	| 'html_artifact'
	| 'agent_pack'
	| 'report'
	| 'graph_artifact'
	| 'executive_output'
	| 'unknown';

export const OUTPUT_DISPLAY_KIND_LABELS: Record<OutputDisplayKind, string> = {
	agent_pack: 'derived Agent Pack',
	canonical_markdown: 'canonical Markdown',
	executive_output: 'derived Executive output',
	graph_artifact: 'derived graph artifact',
	html_artifact: 'derived HTML artifact',
	report: 'derived report',
	unknown: 'unknown',
};

/**
 * Normalize a workspace artifact type into a display kind.
 * Handles executive_* subtypes and data artifacts with graph metadata.
 */
export function normalizeDisplayKind(
	artifact: WorkspaceArtifact,
): OutputDisplayKind {
	switch (artifact.artifactType) {
		case 'canonical_markdown':
			return 'canonical_markdown';
		case 'html':
			return 'html_artifact';
		case 'agent_pack':
			return 'agent_pack';
		case 'report':
			return 'report';
		case 'executive_json':
		case 'executive_markdown':
		case 'executive_html':
			return 'executive_output';
		case 'data':
			if (
				artifact.metadata &&
				typeof artifact.metadata === 'object' &&
				(artifact.metadata as Record<string, unknown>).subtype ===
					'graph_artifact'
			) {
				return 'graph_artifact';
			}
			return 'report';
		default:
			return 'unknown';
	}
}

// ---------------------------------------------------------------------------
// Canonicality display label
// ---------------------------------------------------------------------------

export function canonicalityLabel(
	artifact: WorkspaceArtifact,
): 'canonical' | 'derived' {
	if (artifact.isCanonical) return 'canonical';
	return 'derived';
}

// ---------------------------------------------------------------------------
// Output browser filter contracts
// ---------------------------------------------------------------------------

export interface OutputBrowserFilter {
	/** Filter by artifact type */
	artifactType?: WorkspaceArtifact['artifactType'] | undefined;
	/** Filter by display kind */
	displayKind?: OutputDisplayKind | undefined;
	/** Filter by canonicality */
	canonicality?: 'canonical' | 'derived' | undefined;
	/** Filter by status */
	status?: WorkspaceArtifact['status'] | undefined;
	/** Filter by source document ID */
	documentId?: string | undefined;
	/** Filter by phase ID (from metadata if available) */
	phaseId?: string | undefined;
	/** Filter by profile ID (from metadata if available) */
	profileId?: string | undefined;
	/** Filter by containing root path */
	rootPath?: string | undefined;
}

// ---------------------------------------------------------------------------
// Output browser list item (for display)
// ---------------------------------------------------------------------------

export interface OutputBrowserItem {
	artifactId: string;
	artifactType: WorkspaceArtifact['artifactType'];
	displayKind: OutputDisplayKind;
	canonicality: 'canonical' | 'derived';
	status: WorkspaceArtifact['status'];
	path: string;
	generatedAt: string | undefined;
	sourceDocumentIds: string[];
	checksum?: string | undefined;
	runId?: string | undefined;
	profileId?: string | undefined;
	profileVersion?: string | undefined;
	documentationRoot?: string | undefined;
	diagnostics: OutputBrowserDiagnostic[];
}

// ---------------------------------------------------------------------------
// Output browser diagnostic
// ---------------------------------------------------------------------------

export interface OutputBrowserDiagnostic {
	code: string;
	severity: 'error' | 'warning' | 'info';
	message: string;
	recoveryHint?: string | undefined;
}

// ---------------------------------------------------------------------------
// Output detail view
// ---------------------------------------------------------------------------

export interface OutputDetailView {
	artifactId: string;
	artifactType: WorkspaceArtifact['artifactType'];
	displayKind: OutputDisplayKind;
	canonicality: 'canonical' | 'derived';
	status: WorkspaceArtifact['status'];
	path: string;
	sourceDocumentIds: string[];
	sourceArtifactIds: string[];
	checksum?: string | undefined;
	generatedAt?: string | undefined;
	runId?: string | undefined;
	profileId?: string | undefined;
	profileVersion?: string | undefined;
	documentationRoot?: string | undefined;
	metadata?: Record<string, unknown> | undefined;
	diagnostics: OutputBrowserDiagnostic[];
	nextActions: string[];
}

// ---------------------------------------------------------------------------
// Output sources view
// ---------------------------------------------------------------------------

export interface OutputSourcesView {
	artifactId: string;
	sourceDocumentIds: string[];
	sourceArtifactIds: string[];
	sourcePaths: string[];
	sourceChecksums: { artifactId: string; checksum?: string }[];
}

// ---------------------------------------------------------------------------
// Stale outputs view
// ---------------------------------------------------------------------------

export interface StaleOutputsView {
	staleCount: number;
	orphanedCount: number;
	missingCount: number;
	blockedCount: number;
	items: OutputBrowserItem[];
	nextActions: string[];
}

// ---------------------------------------------------------------------------
// Output browser summary
// ---------------------------------------------------------------------------

export interface OutputBrowserSummary {
	totalArtifacts: number;
	canonicalCount: number;
	derivedCount: number;
	staleCount: number;
	currentCount: number;
	failedCount: number;
	blockedCount: number;
	countsByType: Record<string, number>;
	countsByStatus: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Build an OutputBrowserItem from a WorkspaceArtifact
// ---------------------------------------------------------------------------

export function toOutputBrowserItem(
	artifact: WorkspaceArtifact,
): OutputBrowserItem {
	const displayKind = normalizeDisplayKind(artifact);
	const meta = artifact.metadata as Record<string, unknown> | undefined;
	const diagnostics: OutputBrowserDiagnostic[] = [];

	if (artifact.status === 'stale') {
		diagnostics.push({
			code: 'LOGOS_OUTPUT_STALE',
			message: 'Source state has changed; regeneration recommended.',
			recoveryHint: 'Run /generate to regenerate this artifact.',
			severity: 'warning',
		});
	}
	if (artifact.status === 'failed') {
		diagnostics.push({
			code: 'LOGOS_OUTPUT_FAILED',
			message: 'This artifact failed during generation.',
			recoveryHint: 'Review diagnostics or rerun /generate.',
			severity: 'error',
		});
	}
	if (artifact.status === 'blocked') {
		diagnostics.push({
			code: 'LOGOS_OUTPUT_BLOCKED',
			message: 'This artifact is blocked by unresolved dependencies.',
			recoveryHint: 'Resolve blocking issues and regenerate with /generate.',
			severity: 'warning',
		});
	}

	return {
		artifactId: artifact.artifactId,
		artifactType: artifact.artifactType,
		canonicality: canonicalityLabel(artifact),
		checksum: artifact.checksum,
		diagnostics,
		displayKind,
		documentationRoot:
			typeof meta?.documentationRoot === 'string'
				? meta.documentationRoot
				: undefined,
		generatedAt: artifact.generatedAt,
		path: artifact.path,
		profileId: typeof meta?.profileId === 'string' ? meta.profileId : undefined,
		profileVersion:
			typeof meta?.profileVersion === 'string'
				? meta.profileVersion
				: undefined,
		runId: artifact.runId,
		sourceDocumentIds: artifact.sourceDocumentIds,
		status: artifact.status,
	};
}

// ---------------------------------------------------------------------------
// Build an OutputDetailView from a WorkspaceArtifact
// ---------------------------------------------------------------------------

export function toOutputDetailView(
	artifact: WorkspaceArtifact,
	sourceArtifactIds: string[] = [],
): OutputDetailView {
	const item = toOutputBrowserItem(artifact);
	const nextActions: string[] = [];

	nextActions.push(`/outputs sources ${artifact.artifactId}`);
	if (
		artifact.status === 'stale' ||
		artifact.status === 'failed' ||
		artifact.status === 'blocked'
	) {
		nextActions.push('/generate');
	}
	nextActions.push('/validate');
	nextActions.push('/status');

	return {
		...item,
		metadata: artifact.metadata,
		nextActions,
		sourceArtifactIds,
	};
}

// ---------------------------------------------------------------------------
// Filter an artifact against OutputBrowserFilter
// ---------------------------------------------------------------------------

export function matchesOutputFilter(
	artifact: WorkspaceArtifact,
	filter: OutputBrowserFilter,
): boolean {
	const meta = artifact.metadata as Record<string, unknown> | undefined;
	const item = toOutputBrowserItem(artifact);

	if (
		filter.artifactType !== undefined &&
		artifact.artifactType !== filter.artifactType
	) {
		return false;
	}
	if (
		filter.displayKind !== undefined &&
		item.displayKind !== filter.displayKind
	) {
		return false;
	}
	if (
		filter.canonicality !== undefined &&
		item.canonicality !== filter.canonicality
	) {
		return false;
	}
	if (filter.status !== undefined && artifact.status !== filter.status) {
		return false;
	}
	if (
		filter.documentId !== undefined &&
		!artifact.sourceDocumentIds.includes(filter.documentId)
	) {
		return false;
	}
	if (filter.phaseId !== undefined) {
		const phaseIds: unknown = meta?.sourcePhaseIds;
		if (Array.isArray(phaseIds) && phaseIds.includes(filter.phaseId)) {
			// pass
		} else if (meta?.phaseId === filter.phaseId) {
			// pass
		} else {
			return false;
		}
	}
	if (filter.profileId !== undefined && meta?.profileId !== filter.profileId) {
		return false;
	}
	if (
		filter.rootPath !== undefined &&
		typeof meta?.documentationRoot === 'string'
	) {
		if (
			!meta.documentationRoot.startsWith(filter.rootPath.replace(/\/$/, ''))
		) {
			return false;
		}
	}

	return true;
}
