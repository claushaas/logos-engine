/**
 * Output Browser Service — Phase 7: Derived Artifact Generation And Browsing
 *
 * Read-only service that queries the artifact registry from workspace state.
 * No writes, no filesystem access, no provider calls, no network.
 *
 * Provides listing, filtering, detail, source, and staleness views for
 * artifacts of all types — canonical and derived.
 */

import {
	listArtifacts,
	summarizeArtifacts,
} from '../state/artifact-registry.js';
import type { WorkspaceState } from '../state/workspace-state.schema.js';
import { readWorkspaceState } from '../state/workspace-state-repository.js';
import {
	matchesOutputFilter,
	type OutputBrowserFilter,
	type OutputBrowserItem,
	type OutputBrowserSummary,
	type OutputDetailView,
	type OutputSourcesView,
	type StaleOutputsView,
	toOutputBrowserItem,
	toOutputDetailView,
} from './output-browser-model.js';

// ---------------------------------------------------------------------------
// Service options
// ---------------------------------------------------------------------------

export interface OutputBrowserOptions {
	projectRoot: string;
	filter?: OutputBrowserFilter | undefined;
}

// ---------------------------------------------------------------------------
// Read workspace state from project root
// ---------------------------------------------------------------------------

async function loadState(projectRoot: string): Promise<{
	state: WorkspaceState;
	success: boolean;
	error?: string | undefined;
}> {
	try {
		const result = await readWorkspaceState({ projectRoot });
		if (!result.success || !result.state) {
			return {
				error:
					'Workspace state not found or not initialized. Run /init to create a workspace.',
				state: undefined as unknown as WorkspaceState,
				success: false,
			};
		}
		return { state: result.state, success: true };
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return {
			error: `Failed to read workspace state: ${message}`,
			state: undefined as unknown as WorkspaceState,
			success: false,
		};
	}
}

// ---------------------------------------------------------------------------
// List outputs with optional filter
// ---------------------------------------------------------------------------

export interface ListOutputsResult {
	items: OutputBrowserItem[];
	totalCount: number;
	filteredCount: number;
	filter?: OutputBrowserFilter | undefined;
	summary: OutputBrowserSummary;
}

export async function listOutputs(
	options: OutputBrowserOptions,
): Promise<ListOutputsResult | { error: string }> {
	const loaded = await loadState(options.projectRoot);
	if (!loaded.success) {
		return { error: loaded.error ?? 'Unknown error loading workspace state.' };
	}

	const allArtifacts = listArtifacts({ state: loaded.state });
	const filter = options.filter ?? {};

	const filtered =
		filter && Object.keys(filter).length > 0
			? allArtifacts.filter((a) => matchesOutputFilter(a, filter))
			: allArtifacts;

	const items = filtered.map(toOutputBrowserItem);

	const summary: OutputBrowserSummary = {
		blockedCount: 0,
		canonicalCount: 0,
		countsByStatus: {},
		countsByType: {},
		currentCount: 0,
		derivedCount: 0,
		failedCount: 0,
		staleCount: 0,
		totalArtifacts: allArtifacts.length,
	};

	for (const a of allArtifacts) {
		if (a.isCanonical) summary.canonicalCount++;
		else summary.derivedCount++;
		summary.countsByType[a.artifactType] =
			(summary.countsByType[a.artifactType] ?? 0) + 1;
		summary.countsByStatus[a.status] =
			(summary.countsByStatus[a.status] ?? 0) + 1;
		if (a.status === 'stale') summary.staleCount++;
		if (a.status === 'generated') summary.currentCount++;
		if (a.status === 'failed') summary.failedCount++;
		if (a.status === 'blocked') summary.blockedCount++;
	}

	return {
		filter: Object.keys(filter).length > 0 ? filter : undefined,
		filteredCount: items.length,
		items,
		summary,
		totalCount: allArtifacts.length,
	};
}

// ---------------------------------------------------------------------------
// Get output detail by artifact ID
// ---------------------------------------------------------------------------

export async function getOutput(
	projectRoot: string,
	artifactId: string,
): Promise<OutputDetailView | { error: string }> {
	const loaded = await loadState(projectRoot);
	if (!loaded.success) {
		return { error: loaded.error ?? 'Unknown error loading workspace state.' };
	}

	const artifact = loaded.state.artifacts.find(
		(a) => a.artifactId === artifactId,
	);
	if (!artifact) {
		return {
			error: `Output "${artifactId}" not found in artifact registry. Run /outputs to list available outputs.`,
		};
	}

	// Find related source artifacts (artifacts that share source documents)
	const sourceArtifactIds: string[] = [];
	for (const a of loaded.state.artifacts) {
		if (a.artifactId === artifactId) continue;
		for (const docId of artifact.sourceDocumentIds) {
			if (
				a.sourceDocumentIds.includes(docId) &&
				!sourceArtifactIds.includes(a.artifactId)
			) {
				sourceArtifactIds.push(a.artifactId);
			}
		}
	}

	return toOutputDetailView(artifact, sourceArtifactIds);
}

// ---------------------------------------------------------------------------
// Get output sources by artifact ID
// ---------------------------------------------------------------------------

export async function getOutputSources(
	projectRoot: string,
	artifactId: string,
): Promise<OutputSourcesView | { error: string }> {
	const loaded = await loadState(projectRoot);
	if (!loaded.success) {
		return { error: loaded.error ?? 'Unknown error loading workspace state.' };
	}

	const artifact = loaded.state.artifacts.find(
		(a) => a.artifactId === artifactId,
	);
	if (!artifact) {
		return { error: `Output "${artifactId}" not found in artifact registry.` };
	}

	// Find source artifacts
	const sourceArtifactIds: string[] = [];
	const sourcePaths: string[] = [];
	const sourceChecksums: { artifactId: string; checksum?: string }[] = [];

	for (const a of loaded.state.artifacts) {
		if (a.artifactId === artifactId) continue;
		for (const docId of artifact.sourceDocumentIds) {
			if (
				a.sourceDocumentIds.includes(docId) &&
				!sourceArtifactIds.includes(a.artifactId)
			) {
				sourceArtifactIds.push(a.artifactId);
				sourcePaths.push(a.path);
				const entry: { artifactId: string; checksum?: string } = {
					artifactId: a.artifactId,
				};
				if (a.checksum !== undefined) entry.checksum = a.checksum;
				sourceChecksums.push(entry);
			}
		}
	}

	return {
		artifactId,
		sourceArtifactIds,
		sourceChecksums,
		sourceDocumentIds: artifact.sourceDocumentIds,
		sourcePaths,
	};
}

// ---------------------------------------------------------------------------
// List stale outputs
// ---------------------------------------------------------------------------

export async function listStaleOutputs(
	projectRoot: string,
): Promise<StaleOutputsView | { error: string }> {
	const loaded = await loadState(projectRoot);
	if (!loaded.success) {
		return { error: loaded.error ?? 'Unknown error loading workspace state.' };
	}

	const staleArtifacts = loaded.state.artifacts.filter(
		(a) =>
			a.status === 'stale' || a.status === 'missing' || a.status === 'blocked',
	);

	const orphanedArtifacts = loaded.state.artifacts.filter(
		(a) => a.status === 'missing',
	);

	const items = staleArtifacts.map(toOutputBrowserItem);

	return {
		blockedCount: staleArtifacts.filter((a) => a.status === 'blocked').length,
		items,
		missingCount: staleArtifacts.filter((a) => a.status === 'missing').length,
		nextActions: [
			'Run /generate to regenerate stale outputs.',
			'Run /diagnose to assess blocking issues.',
			'Run /outputs show <id> for detailed diagnostics.',
		],
		orphanedCount: orphanedArtifacts.length,
		staleCount: staleArtifacts.filter((a) => a.status === 'stale').length,
	};
}

// ---------------------------------------------------------------------------
// Summarize all outputs (compact)
// ---------------------------------------------------------------------------

export async function summarizeOutputs(
	projectRoot: string,
): Promise<OutputBrowserSummary | { error: string }> {
	const loaded = await loadState(projectRoot);
	if (!loaded.success) {
		return { error: loaded.error ?? 'Unknown error loading workspace state.' };
	}

	const summary = summarizeArtifacts(loaded.state);

	const currentCount = loaded.state.artifacts.filter(
		(a) => a.status === 'generated',
	).length;
	const staleCount = loaded.state.artifacts.filter(
		(a) => a.status === 'stale',
	).length;
	const failedCount = loaded.state.artifacts.filter(
		(a) => a.status === 'failed',
	).length;
	const blockedCount = loaded.state.artifacts.filter(
		(a) => a.status === 'blocked',
	).length;

	return {
		blockedCount,
		canonicalCount: summary.canonicalCount,
		countsByStatus: {
			blocked: blockedCount,
			failed: failedCount,
			generated: currentCount,
			missing: loaded.state.artifacts.filter((a) => a.status === 'missing')
				.length,
			planned: loaded.state.artifacts.filter((a) => a.status === 'planned')
				.length,
			skipped: loaded.state.artifacts.filter((a) => a.status === 'skipped')
				.length,
			stale: staleCount,
		},
		countsByType: summary.countsByType,
		currentCount,
		derivedCount: summary.nonCanonicalCount,
		failedCount,
		staleCount,
		totalArtifacts: summary.totalArtifacts,
	};
}
