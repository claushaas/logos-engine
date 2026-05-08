import type { DecisionStore } from '../domain/decision-registry.js';
import {
	getDefaultProfileDirectory,
	loadProfileContract,
} from '../domain/profile-loader.js';
import { readWorkspaceState } from '../domain/workspace-state.js';
import { detectProjectRoot } from '../storage/project-root.js';
import type {
	ValidationFinding,
	ValidationResult,
} from '../validation/validation-engine.js';
import { runValidation } from '../validation/validation-engine.js';

export type ValidationCommandOptions = {
	readonly phaseId?: string | undefined;
	readonly all?: boolean | undefined;
};

export type ValidationCommandResult = {
	readonly lines: readonly string[];
	readonly status: 'error' | 'ok' | 'warning';
	readonly title: string;
};

export function validateWorkspace(
	cwd: string,
	options: ValidationCommandOptions = {},
): ValidationCommandResult {
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

		const decisionStore: DecisionStore = {
			decisions: workspace.decisions.decisions,
		};
		const validationOptions = options.phaseId
			? { phaseId: options.phaseId }
			: undefined;

		const result = runValidation(
			profile.validationRules,
			profile.riskPatterns,
			decisionStore,
			validationOptions,
		);

		const lines = formatValidationResult(result, options);

		const overallStatus =
			result.summary.criticalCount > 0
				? 'error'
				: result.summary.errorCount > 0
					? 'error'
					: result.summary.warningCount > 0
						? 'warning'
						: 'ok';

		return {
			lines,
			status: overallStatus,
			title: options.phaseId
				? `Validation: ${options.phaseId}`
				: 'Validation results',
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);

		return {
			lines: [
				message,
				'Ensure the workspace is initialized with /init before validating.',
			],
			status: 'error',
			title: 'Validation failed',
		};
	}
}

export function formatValidationResult(
	result: ValidationResult,
	options: ValidationCommandOptions,
): readonly string[] {
	const lines: string[] = [];

	lines.push(
		`Findings: ${result.summary.totalCount} total`,
		`  Critical: ${result.summary.criticalCount}`,
		`  Error: ${result.summary.errorCount}`,
		`  Warning: ${result.summary.warningCount}`,
		`  Info: ${result.summary.infoCount}`,
	);

	if (result.findings.length === 0) {
		lines.push('', 'No issues found.');
		return lines;
	}

	const bySeverity = groupBySeverity(result.findings);

	for (const severity of ['critical', 'error', 'warning', 'info'] as const) {
		const findings = bySeverity[severity];
		if (findings.length === 0) continue;

		lines.push('', `${severity.toUpperCase()} (${findings.length}):`);

		for (const finding of findings) {
			lines.push(`  ${finding.title}`);
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

	if (options.all && result.byPhase.size > 1) {
		lines.push('', 'By phase:');
		for (const [phaseId, phaseFindings] of result.byPhase) {
			lines.push(`  ${phaseId}: ${phaseFindings.length} finding(s)`);
		}
	}

	return lines;
}

function groupBySeverity(
	findings: readonly ValidationFinding[],
): Record<ValidationFinding['severity'], ValidationFinding[]> {
	const result: Record<ValidationFinding['severity'], ValidationFinding[]> = {
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
