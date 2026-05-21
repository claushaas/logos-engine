/** Run Metadata Primitives — create, update, list, and summarize runs */

import type {
	WorkspaceRunRecord,
	WorkspaceState,
} from './workspace-state.schema.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RunType = WorkspaceRunRecord['runType'];
export type RunStatus = WorkspaceRunRecord['status'];

export interface RunRecordInput {
	runType: RunType;
	status?: RunStatus;
	startedAt?: string;
	completedAt?: string | undefined;
	command?: string | undefined;
	dryRun?: boolean;
	changedPaths?: string[];
	warnings?: string[];
	errors?: string[];
	relatedArtifactIds?: string[];
	findingIds?: string[];
}

export interface CreateRunRecordOptions {
	state: WorkspaceState;
	input: RunRecordInput;
	idFactory?: () => string;
	clock?: Clock;
}

export interface UpdateRunRecordOptions {
	state: WorkspaceState;
	runId: string;
	updates: Partial<Omit<WorkspaceRunRecord, 'runId'>>;
}

export interface ListRunRecordsOptions {
	state: WorkspaceState;
	filterByType?: RunType | undefined;
	filterByStatus?: RunStatus | undefined;
}

export interface RunSummary {
	totalRuns: number;
	totalValidationRuns: number;
	totalDiagnosticRuns: number;
	totalGenerationRuns: number;
	totalExecutiveRuns: number;
	latestRun?: WorkspaceRunRecord | undefined;
}

export interface Clock {
	now(): string;
}

const defaultClock: Clock = {
	now: () => new Date().toISOString(),
};

function defaultIdFactory(): string {
	return `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export function createRunRecord(options: CreateRunRecordOptions): {
	state: WorkspaceState;
	run: WorkspaceRunRecord;
} {
	const clock = options.clock ?? defaultClock;
	const idFactory = options.idFactory ?? defaultIdFactory;
	const now = clock.now();

	const run: WorkspaceRunRecord = {
		changedPaths: options.input.changedPaths ?? [],
		command: options.input.command,
		completedAt: options.input.completedAt,
		dryRun: options.input.dryRun ?? false,
		errors: options.input.errors ?? [],
		findingIds: options.input.findingIds ?? [],
		relatedArtifactIds: options.input.relatedArtifactIds ?? [],
		runId: idFactory(),
		runType: options.input.runType,
		startedAt: options.input.startedAt ?? now,
		status: options.input.status ?? 'planned',
		warnings: options.input.warnings ?? [],
	};

	const nextState: WorkspaceState = {
		...options.state,
		runs: [...options.state.runs, run],
	};

	return { run, state: nextState };
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

export function updateRunRecord(options: UpdateRunRecordOptions): {
	state: WorkspaceState;
	run: WorkspaceRunRecord;
	found: boolean;
} {
	let found = false;
	let updatedRun: WorkspaceRunRecord | undefined;

	const nextRuns = options.state.runs.map((r) => {
		if (r.runId !== options.runId) return r;
		found = true;
		updatedRun = { ...r, ...options.updates };
		return updatedRun;
	});

	if (!found) {
		return {
			found: false,
			run: undefined as unknown as WorkspaceRunRecord,
			state: options.state,
		};
	}

	const nextState: WorkspaceState = {
		...options.state,
		runs: nextRuns,
	};

	return {
		found: true,
		run: updatedRun as WorkspaceRunRecord,
		state: nextState,
	};
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

export function listRunRecords(
	options: ListRunRecordsOptions,
): WorkspaceRunRecord[] {
	let result = [...options.state.runs];

	if (options.filterByType) {
		result = result.filter((r) => r.runType === options.filterByType);
	}

	if (options.filterByStatus) {
		result = result.filter((r) => r.status === options.filterByStatus);
	}

	// Sort by startedAt descending for determinism
	result.sort((a, b) => {
		if (a.startedAt < b.startedAt) return 1;
		if (a.startedAt > b.startedAt) return -1;
		return a.runId.localeCompare(b.runId);
	});

	return result;
}

// ---------------------------------------------------------------------------
// Summarize
// ---------------------------------------------------------------------------

export function summarizeRuns(state: WorkspaceState): RunSummary {
	const runs = listRunRecords({ state });

	return {
		latestRun: runs[0],
		totalDiagnosticRuns: runs.filter((r) => r.runType === 'diagnostic').length,
		totalExecutiveRuns: runs.filter((r) => r.runType === 'executive').length,
		totalGenerationRuns: runs.filter((r) => r.runType === 'generation').length,
		totalRuns: runs.length,
		totalValidationRuns: runs.filter((r) => r.runType === 'validation').length,
	};
}
