import type { LlmProvider } from '../ai/llm-provider.js';
import { createMockLlmProvider } from '../ai/mock-provider.js';
import type { DiagnosticsResult } from '../diagnostics/diagnostics-engine.js';
import {
	buildDiagnosticsContext,
	runDeterministicDiagnostics,
} from '../diagnostics/diagnostics-engine.js';
import {
	getDefaultProfileDirectory,
	loadProfileContract,
} from '../domain/profile-loader.js';
import { readWorkspaceState } from '../domain/workspace-state.js';
import { detectProjectRoot } from '../storage/project-root.js';
import { runValidation } from '../validation/validation-engine.js';

export type DiagnosticsCommandOptions = {
	readonly includeAiAnalysis?: boolean | undefined;
	readonly phaseId?: string | undefined;
};

export type DiagnosticsCommandResult = {
	readonly lines: readonly string[];
	readonly status: 'error' | 'ok' | 'warning';
	readonly title: string;
};

export function diagnoseWorkspace(
	cwd: string,
	options: DiagnosticsCommandOptions = {},
): DiagnosticsCommandResult {
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

		const decisionStore = {
			decisions: workspace.decisions.decisions,
		};

		// Build diagnostics context from workspace state
		const affectedDocuments = profile.documents
			.filter((doc) => {
				const hasRequiredDecisions = doc.requiredInputs.decisions.some(
					(decisionId) =>
						workspace.decisions.decisions.some(
							(d) => d.id === decisionId && d.status === 'confirmed',
						),
				);
				return hasRequiredDecisions;
			})
			.map((doc) => doc.id);

		const openQuestionIds = workspace.answers.answers
			.filter((answer) => answer.status === 'unknown')
			.map((answer) => answer.questionId);

		const assumptionIds = [
			...workspace.answers.answers
				.filter((answer) => answer.status === 'assumption')
				.map((answer) => answer.questionId),
			...workspace.decisions.decisions
				.filter((decision) => decision.status === 'assumed')
				.map((decision) => decision.id),
		];

		const diagnosticsContext = buildDiagnosticsContext(
			decisionStore,
			affectedDocuments,
			openQuestionIds,
			assumptionIds,
		);

		// Run deterministic validation to always have a baseline
		const validationResult = runValidation(
			profile.validationRules,
			profile.riskPatterns,
			decisionStore,
			options.phaseId ? { phaseId: options.phaseId } : undefined,
		);

		// For Phase 10, we run deterministic diagnostics.
		// AI-assisted diagnostics path is architected but uses mock provider by default
		// to ensure tests do not require live model calls.
		const provider = resolveProvider(workspace.config);
		const useLiveAi =
			options.includeAiAnalysis === true &&
			provider.metadata.providerId !== 'mock';

		if (useLiveAi) {
			// AI-assisted path: return deterministic baseline with a note
			const diagnosticsResult = runDeterministicDiagnostics(
				validationResult,
				diagnosticsContext,
			);

			const lines = formatDiagnosticsResult(diagnosticsResult, true);
			const overallStatus = determineOverallStatus(diagnosticsResult);

			return {
				lines,
				status: overallStatus,
				title: options.phaseId
					? `Diagnostics: ${options.phaseId}`
					: 'Diagnostics results',
			};
		}

		// Deterministic-only path (default)
		const diagnosticsResult = runDeterministicDiagnostics(
			validationResult,
			diagnosticsContext,
		);

		const lines = formatDiagnosticsResult(diagnosticsResult, false);
		const overallStatus = determineOverallStatus(diagnosticsResult);

		return {
			lines,
			status: overallStatus,
			title: options.phaseId
				? `Diagnostics: ${options.phaseId}`
				: 'Diagnostics results',
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);

		return {
			lines: [
				message,
				'Ensure the workspace is initialized with /init before running diagnostics.',
			],
			status: 'error',
			title: 'Diagnostics failed',
		};
	}
}

function resolveProvider(_config: {
	ai: { enabled: boolean; provider: string };
}): LlmProvider {
	// For now, always return mock provider.
	// Live provider resolution will be added when AI configuration is wired.
	return createMockLlmProvider();
}

export function formatDiagnosticsResult(
	result: DiagnosticsResult,
	aiRequestedButUnavailable: boolean = false,
): readonly string[] {
	const lines: string[] = [];

	lines.push(
		`Findings: ${result.summary.totalCount} total`,
		`  Critical: ${result.summary.criticalCount}`,
		`  Error: ${result.summary.errorCount}`,
		`  Warning: ${result.summary.warningCount}`,
		`  Info: ${result.summary.infoCount}`,
	);

	if (result.generatedWithoutLiveAi) {
		lines.push(
			'',
			'Note: Diagnostics were generated without live AI analysis.',
		);
	}

	if (aiRequestedButUnavailable) {
		lines.push(
			'',
			'Note: AI analysis was requested but no live provider is configured.',
		);
	}

	if (result.findings.length === 0 && result.aiContributions.length === 0) {
		lines.push('', 'No issues found.');
		if (result.nextRecommendedAction) {
			lines.push('', `Next step: ${result.nextRecommendedAction}`);
		}
		return lines;
	}

	// Group findings by severity dynamically
	const severityGroups = groupFindingsBySeverity(result.findings);

	for (const severity of ['critical', 'error', 'warning', 'info'] as const) {
		const findings = severityGroups[severity];
		if (findings.length === 0) continue;

		lines.push('', `${severity.toUpperCase()} (${findings.length}):`);

		for (const finding of findings) {
			const sourcePrefix = finding.source === 'ai' ? '[AI Advisory] ' : '';
			lines.push(`  ${sourcePrefix}${finding.title}`);
			lines.push(`    ${finding.description}`);

			if (finding.affectedDecisionIds.length > 0) {
				lines.push(
					`    Missing decisions: ${finding.affectedDecisionIds.join(', ')}`,
				);
			}

			if (finding.affectedDocuments.length > 0) {
				lines.push(
					`    Affected documents: ${finding.affectedDocuments.join(', ')}`,
				);
			}

			if (finding.suggestedNextAction) {
				lines.push(`    Next action: ${finding.suggestedNextAction}`);
			}
		}
	}

	// Show AI contributions section if any exist
	if (result.aiContributions.length > 0) {
		lines.push('', 'AI-ASSISTED INSIGHTS:');
		lines.push(
			'The following observations were generated by AI and are advisory only.',
		);

		for (const contrib of result.aiContributions) {
			lines.push(
				`  [${contrib.operationId}] ${contrib.finding.title} (${contrib.status})`,
			);
			lines.push(`    ${contrib.finding.description}`);
		}
	}

	// Show affected documents summary
	if (result.affectedDocuments.length > 0) {
		lines.push(
			'',
			`Affected documents: ${result.affectedDocuments.join(', ')}`,
		);
	}

	// Show next recommended action
	if (result.nextRecommendedAction) {
		lines.push('', `Recommended next step: ${result.nextRecommendedAction}`);
	}

	return lines;
}

function groupFindingsBySeverity(
	findings: readonly DiagnosticsResult['findings'][number][],
): Record<ValidationSeverity, DiagnosticsResult['findings']> {
	const result: Record<
		ValidationSeverity,
		DiagnosticsResult['findings'][number][]
	> = {
		critical: [],
		error: [],
		info: [],
		warning: [],
	};

	for (const finding of findings) {
		result[finding.severity].push(finding);
	}

	return result;
}

function determineOverallStatus(
	result: DiagnosticsResult,
): DiagnosticsCommandResult['status'] {
	if (result.summary.criticalCount > 0) return 'error';
	if (result.summary.errorCount > 0) return 'error';
	if (result.summary.warningCount > 0) return 'warning';
	return 'ok';
}
