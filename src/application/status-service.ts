import {
	getDefaultProfileDirectory,
	loadProfileContract,
} from '../domain/profile-loader.js';
import { readWorkspaceState } from '../domain/workspace-state.js';
import { detectProjectRoot } from '../storage/project-root.js';

export type PhaseProgress = {
	readonly completedDecisions: number;
	readonly confirmedDecisions: number;
	readonly phaseId: string;
	readonly progressPercent: number;
	readonly title: string;
	readonly totalDecisions: number;
};

export type ProjectStatus = {
	readonly overallProgressPercent: number;
	readonly phaseProgress: readonly PhaseProgress[];
	readonly profileName: string;
	readonly projectName: string;
	readonly totalAnswers: number;
	readonly totalConfirmedDecisions: number;
	readonly totalDecisions: number;
	readonly totalUnknownAnswers: number;
};

export type StatusCommandResult = {
	readonly lines: readonly string[];
	readonly status: 'error' | 'ok';
	readonly title: string;
};

export function getProjectStatus(cwd: string): StatusCommandResult {
	const projectRoot = detectProjectRoot(cwd);

	if (!projectRoot) {
		return {
			lines: [
				'No LOGOS workspace found.',
				'Run /init to create a workspace first.',
			],
			status: 'error',
			title: 'No workspace found',
		};
	}

	try {
		const workspace = readWorkspaceState(projectRoot);
		const profileDirectory = getDefaultProfileDirectory(
			workspace.project.profileId,
		);
		const profile = loadProfileContract(profileDirectory);

		const status = calculateProjectStatus(workspace, profile);
		const lines = formatProjectStatus(status);

		return {
			lines,
			status: 'ok',
			title: 'Project status',
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);

		return {
			lines: [
				message,
				'Ensure the workspace is initialized with /init before checking status.',
			],
			status: 'error',
			title: 'Status failed',
		};
	}
}

export function calculateProjectStatus(
	workspace: ReturnType<typeof readWorkspaceState>,
	profile: ReturnType<typeof loadProfileContract>,
): ProjectStatus {
	const allDecisions = workspace.decisions.decisions;
	const allAnswers = workspace.answers.answers;

	const phaseProgress = profile.phases.map((phase) => {
		const phaseDocuments = profile.documents.filter(
			(document) => document.phaseId === phase.id,
		);
		const phaseDecisionIds = new Set(
			phaseDocuments.flatMap((document) => document.requiredInputs.decisions),
		);
		const phaseDecisions = allDecisions.filter((decision) =>
			phaseDecisionIds.has(decision.id),
		);
		const confirmedCount = phaseDecisions.filter(
			(decision) => decision.status === 'confirmed',
		).length;
		const totalCount = phaseDecisionIds.size;
		const progressPercent =
			totalCount === 0 ? 0 : Math.round((confirmedCount / totalCount) * 100);

		return {
			completedDecisions: confirmedCount,
			confirmedDecisions: confirmedCount,
			phaseId: phase.id,
			progressPercent,
			title: phase.title,
			totalDecisions: totalCount,
		};
	});

	const totalDecisions = allDecisions.length;
	const totalConfirmedDecisions = allDecisions.filter(
		(decision) => decision.status === 'confirmed',
	).length;
	const overallProgressPercent =
		phaseProgress.length === 0
			? 0
			: Math.round(
					phaseProgress.reduce((sum, phase) => sum + phase.progressPercent, 0) /
						phaseProgress.length,
				);

	return {
		overallProgressPercent,
		phaseProgress,
		profileName: profile.name,
		projectName: workspace.project.projectName,
		totalAnswers: allAnswers.length,
		totalConfirmedDecisions,
		totalDecisions,
		totalUnknownAnswers: allAnswers.filter(
			(answer) => answer.status === 'unknown',
		).length,
	};
}

export function formatProjectStatus(status: ProjectStatus): readonly string[] {
	const lines: string[] = [
		`Profile: ${status.profileName}`,
		`Project: ${status.projectName}`,
		`Overall progress: ${status.overallProgressPercent}%`,
		`Confirmed decisions: ${status.totalConfirmedDecisions} / ${status.totalDecisions}`,
		`Answers recorded: ${status.totalAnswers}`,
		...(status.totalUnknownAnswers > 0
			? [`Unknown answers: ${status.totalUnknownAnswers}`]
			: []),
		'',
		'Progress by phase:',
	];

	for (const phase of status.phaseProgress) {
		const bar = renderProgressBar(phase.progressPercent, 20);
		lines.push(
			`  ${phase.title}: ${bar} ${phase.progressPercent}% (${phase.confirmedDecisions}/${phase.totalDecisions})`,
		);
	}

	if (status.overallProgressPercent === 0) {
		lines.push(
			'',
			'This workspace has no confirmed decisions yet.',
			'Run /continue to begin guided intake.',
		);
	} else if (status.overallProgressPercent < 100) {
		lines.push(
			'',
			'Run /continue to resume intake, or /diagnose to see what remains.',
		);
	} else {
		lines.push(
			'',
			'All phases have confirmed decisions. Run /generate to create documents.',
		);
	}

	return lines;
}

export function renderProgressBar(percent: number, width: number): string {
	const filled = Math.round((percent / 100) * width);
	const empty = width - filled;
	return `[${'█'.repeat(filled)}${'░'.repeat(empty)}]`;
}
