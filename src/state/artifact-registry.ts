/** Artifact Registry Primitives — register, update, list, and summarize artifacts */

import type {
	WorkspaceArtifact,
	WorkspaceState,
} from './workspace-state.schema.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ArtifactType = WorkspaceArtifact['artifactType'];
export type ArtifactStatus = WorkspaceArtifact['status'];

export interface ArtifactRegistryEntryInput {
	artifactType: ArtifactType;
	path: string;
	status?: ArtifactStatus;
	sourceDocumentIds?: string[];
	checksum?: string | undefined;
	generatedAt?: string | undefined;
	runId?: string | undefined;
	isCanonical?: boolean;
	metadata?: Record<string, unknown>;
}

export interface RegisterArtifactOptions {
	state: WorkspaceState;
	input: ArtifactRegistryEntryInput;
	idFactory?: () => string;
}

export interface UpdateArtifactRecordOptions {
	state: WorkspaceState;
	artifactId: string;
	updates: Partial<Omit<WorkspaceArtifact, 'artifactId'>>;
}

export interface ListArtifactsOptions {
	state: WorkspaceState;
	filterByType?: ArtifactType | undefined;
	filterByStatus?: ArtifactStatus | undefined;
}

export interface ArtifactSummary {
	totalArtifacts: number;
	canonicalCount: number;
	nonCanonicalCount: number;
	countsByType: Record<ArtifactType, number>;
	latestArtifact?: WorkspaceArtifact | undefined;
}

function defaultIdFactory(): string {
	return `art-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ---------------------------------------------------------------------------
// Derived artifact canonicality rules
// ---------------------------------------------------------------------------

const NON_CANONICAL_TYPES: ReadonlySet<ArtifactType> = new Set([
	'html',
	'agent_pack',
	'executive_json',
	'executive_markdown',
	'executive_html',
	'report',
]);

export function isArtifactCanonical(type: ArtifactType): boolean {
	return !NON_CANONICAL_TYPES.has(type);
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export function registerArtifact(options: RegisterArtifactOptions): {
	state: WorkspaceState;
	artifact: WorkspaceArtifact;
} {
	const idFactory = options.idFactory ?? defaultIdFactory;

	const isCanonical =
		options.input.isCanonical ??
		isArtifactCanonical(options.input.artifactType);

	const artifact: WorkspaceArtifact = {
		artifactId: idFactory(),
		artifactType: options.input.artifactType,
		checksum: options.input.checksum,
		generatedAt: options.input.generatedAt,
		isCanonical,
		metadata: options.input.metadata,
		path: options.input.path,
		runId: options.input.runId,
		sourceDocumentIds: options.input.sourceDocumentIds ?? [],
		status: options.input.status ?? 'planned',
	};

	const nextState: WorkspaceState = {
		...options.state,
		artifacts: [...options.state.artifacts, artifact],
	};

	return { artifact, state: nextState };
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

export function updateArtifactRecord(options: UpdateArtifactRecordOptions): {
	state: WorkspaceState;
	artifact: WorkspaceArtifact;
	found: boolean;
} {
	let found = false;
	let updatedArtifact: WorkspaceArtifact | undefined;

	const nextArtifacts = options.state.artifacts.map((a) => {
		if (a.artifactId !== options.artifactId) return a;
		found = true;
		updatedArtifact = { ...a, ...options.updates };
		return updatedArtifact;
	});

	if (!found) {
		return {
			artifact: undefined as unknown as WorkspaceArtifact,
			found: false,
			state: options.state,
		};
	}

	const nextState: WorkspaceState = {
		...options.state,
		artifacts: nextArtifacts,
	};

	return {
		artifact: updatedArtifact as WorkspaceArtifact,
		found: true,
		state: nextState,
	};
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

export function listArtifacts(
	options: ListArtifactsOptions,
): WorkspaceArtifact[] {
	let result = [...options.state.artifacts];

	if (options.filterByType) {
		result = result.filter((a) => a.artifactType === options.filterByType);
	}

	if (options.filterByStatus) {
		result = result.filter((a) => a.status === options.filterByStatus);
	}

	// Sort by generatedAt descending, then by artifactId for determinism
	result.sort((a, b) => {
		const aTime = a.generatedAt ?? '';
		const bTime = b.generatedAt ?? '';
		if (aTime < bTime) return 1;
		if (aTime > bTime) return -1;
		return a.artifactId.localeCompare(b.artifactId);
	});

	return result;
}

// ---------------------------------------------------------------------------
// Summarize
// ---------------------------------------------------------------------------

export function summarizeArtifacts(state: WorkspaceState): ArtifactSummary {
	const artifacts = listArtifacts({ state });
	const countsByType: Record<ArtifactType, number> = {
		agent_pack: 0,
		canonical_markdown: 0,
		data: 0,
		executive_html: 0,
		executive_json: 0,
		executive_markdown: 0,
		html: 0,
		report: 0,
	};

	for (const a of artifacts) {
		countsByType[a.artifactType] = (countsByType[a.artifactType] ?? 0) + 1;
	}

	const canonicalCount = artifacts.filter((a) => a.isCanonical).length;

	return {
		canonicalCount,
		countsByType,
		latestArtifact: artifacts[0],
		nonCanonicalCount: artifacts.length - canonicalCount,
		totalArtifacts: artifacts.length,
	};
}
