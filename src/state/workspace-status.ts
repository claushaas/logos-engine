/** Workspace Status Summary — state-backed status query */

import { summarizeArtifacts } from './artifact-registry.js';
import { summarizeRuns } from './run-repository.js';
import { getCurrentSessionSummary } from './session-repository.js';
import {
	readWorkspaceState,
	type WorkspaceStateReadResult,
} from './workspace-state-repository.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WorkspaceStatusQueryOptions {
	projectRoot: string;
	_fs?: import('../fs/safe-filesystem.js').SafeFsAdapter | undefined;
}

export interface WorkspaceStatusSummary {
	projectRoot: string;
	workspacePath: string;
	initializationState: 'initialized' | 'missing' | 'partial' | 'invalid';
	documentationRoot: string;
	activeProfileId: string | null;
	profileSource?: string | undefined;
	profileVersion?: string | undefined;
	sessionSummary: {
		totalSessions: number;
		activeSessions: number;
		latestSession?:
			| {
					sessionId: string;
					sessionType: string;
					status: string;
					startedAt: string;
			  }
			| undefined;
	};
	runSummary: {
		totalRuns: number;
		totalValidationRuns: number;
		totalDiagnosticRuns: number;
		totalGenerationRuns: number;
		totalExecutiveRuns: number;
		latestRun?:
			| {
					runId: string;
					runType: string;
					status: string;
					startedAt: string;
			  }
			| undefined;
	};
	artifactSummary: {
		totalArtifacts: number;
		canonicalCount: number;
		nonCanonicalCount: number;
		countsByType: Record<string, number>;
		latestArtifact?:
			| {
					artifactId: string;
					artifactType: string;
					status: string;
					path: string;
					isCanonical: boolean;
			  }
			| undefined;
	};
	stalenessSummary?:
		| {
				currentCount: number;
				staleCount: number;
				missingCount: number;
				blockedCount: number;
				orphanedCount: number;
				unknownCount: number;
				total: number;
				optionalDependencyWarningCount: number;
				topStaleReasons: readonly string[];
				topBlockingReasons: readonly string[];
		  }
		| undefined;
	diagnostics: Array<{
		code: string;
		message: string;
		severity: 'error' | 'warning';
		recoveryHint?: string | undefined;
	}>;
}

// ---------------------------------------------------------------------------
// Summary builder
// ---------------------------------------------------------------------------

export async function getWorkspaceStatusSummary(
	options: WorkspaceStatusQueryOptions,
	stalenessResult?: {
		currentCount: number;
		staleCount: number;
		missingCount: number;
		blockedCount: number;
		orphanedCount: number;
		unknownCount: number;
		total: number;
		optionalDependencyWarningCount: number;
		topStaleReasons: readonly string[];
		topBlockingReasons: readonly string[];
	},
): Promise<WorkspaceStatusSummary> {
	const readResult = await readWorkspaceState({
		_fs: options._fs,
		projectRoot: options.projectRoot,
	});

	return buildStatusSummary(options.projectRoot, readResult, stalenessResult);
}

function buildStatusSummary(
	projectRoot: string,
	readResult: WorkspaceStateReadResult,
	stalenessResult?: WorkspaceStatusSummary['stalenessSummary'],
): WorkspaceStatusSummary {
	const state = readResult.state;
	const diagnostics = readResult.diagnostics.map((d) => ({
		code: d.code,
		message: d.message,
		recoveryHint: d.recoveryHint,
		severity: d.severity,
	}));

	if (!state) {
		return {
			activeProfileId: null,
			artifactSummary: {
				canonicalCount: 0,
				countsByType: {},
				nonCanonicalCount: 0,
				totalArtifacts: 0,
			},
			diagnostics,
			documentationRoot: 'logos/',
			initializationState: readResult.initializationState,
			projectRoot,
			runSummary: {
				totalDiagnosticRuns: 0,
				totalExecutiveRuns: 0,
				totalGenerationRuns: 0,
				totalRuns: 0,
				totalValidationRuns: 0,
			},
			sessionSummary: {
				activeSessions: 0,
				totalSessions: 0,
			},
			stalenessSummary: stalenessResult,
			workspacePath: readResult.workspaceFilePath,
		};
	}

	const sessionSummary = getCurrentSessionSummary(state);
	const runSummary = summarizeRuns(state);
	const artifactSummary = summarizeArtifacts(state);

	return {
		activeProfileId: state.profile.profileId,
		artifactSummary: {
			canonicalCount: artifactSummary.canonicalCount,
			countsByType: artifactSummary.countsByType,
			latestArtifact: artifactSummary.latestArtifact
				? {
						artifactId: artifactSummary.latestArtifact.artifactId,
						artifactType: artifactSummary.latestArtifact.artifactType,
						isCanonical: artifactSummary.latestArtifact.isCanonical,
						path: artifactSummary.latestArtifact.path,
						status: artifactSummary.latestArtifact.status,
					}
				: undefined,
			nonCanonicalCount: artifactSummary.nonCanonicalCount,
			totalArtifacts: artifactSummary.totalArtifacts,
		},
		diagnostics,
		documentationRoot: state.documentation.rootPath,
		initializationState: readResult.initializationState,
		profileSource: state.profile.source,
		profileVersion: state.profile.profileVersion,
		projectRoot,
		runSummary: {
			latestRun: runSummary.latestRun
				? {
						runId: runSummary.latestRun.runId,
						runType: runSummary.latestRun.runType,
						startedAt: runSummary.latestRun.startedAt,
						status: runSummary.latestRun.status,
					}
				: undefined,
			totalDiagnosticRuns: runSummary.totalDiagnosticRuns,
			totalExecutiveRuns: runSummary.totalExecutiveRuns,
			totalGenerationRuns: runSummary.totalGenerationRuns,
			totalRuns: runSummary.totalRuns,
			totalValidationRuns: runSummary.totalValidationRuns,
		},
		sessionSummary: {
			activeSessions: sessionSummary.activeSessions,
			latestSession: sessionSummary.latestSession
				? {
						sessionId: sessionSummary.latestSession.sessionId,
						sessionType: sessionSummary.latestSession.sessionType,
						startedAt: sessionSummary.latestSession.startedAt,
						status: sessionSummary.latestSession.status,
					}
				: undefined,
			totalSessions: sessionSummary.totalSessions,
		},
		stalenessSummary: stalenessResult,
		workspacePath: readResult.workspaceFilePath,
	};
}
