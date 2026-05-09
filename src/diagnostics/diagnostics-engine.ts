import type { AiOperationId } from '../ai/ai-operations.js';
import type { LlmProvider } from '../ai/llm-provider.js';
import type { ValidationSeverity } from '../foundation/status-contracts.js';
import type {
	ValidationContext,
	ValidationFinding,
	ValidationResult,
} from '../validation/validation-engine.js';
import { runValidation } from '../validation/validation-engine.js';

export type DiagnosticSource = 'deterministic' | 'ai';

export type DiagnosticCategory =
	| 'gap'
	| 'risk'
	| 'inconsistency'
	| 'next_step'
	| 'weak_document';

export type DiagnosticFinding = {
	affectedDecisionIds: readonly string[];
	affectedDocuments: readonly string[];
	category: DiagnosticCategory;
	description: string;
	id: string;
	severity: ValidationSeverity;
	source: DiagnosticSource;
	suggestedNextAction?: string | undefined;
	title: string;
};

export type AiDiagnosticContribution = {
	finding: DiagnosticFinding;
	operationId: AiOperationId;
	status: 'draft' | 'proposed' | 'needs_review' | 'rejected';
};

export type DiagnosticsResult = {
	affectedDecisions: readonly string[];
	affectedDocuments: readonly string[];
	aiContributions: readonly AiDiagnosticContribution[];
	byCategory: ReadonlyMap<DiagnosticCategory, readonly DiagnosticFinding[]>;
	bySeverity: ReadonlyMap<ValidationSeverity, readonly DiagnosticFinding[]>;
	findings: readonly DiagnosticFinding[];
	generatedWithoutLiveAi: boolean;
	nextRecommendedAction: string | undefined;
	summary: {
		criticalCount: number;
		errorCount: number;
		infoCount: number;
		totalCount: number;
		warningCount: number;
	};
};

export type DiagnosticsContext = ValidationContext & {
	affectedDocuments: readonly string[];
	openQuestionIds: readonly string[];
	assumptionIds: readonly string[];
};

export type DiagnosticsOptions = {
	includeAiAnalysis?: boolean | undefined;
	phaseId?: string | undefined;
	provider?: LlmProvider | undefined;
};

export function createEmptyDiagnosticsResult(): DiagnosticsResult {
	return {
		affectedDecisions: [],
		affectedDocuments: [],
		aiContributions: [],
		byCategory: new Map(),
		bySeverity: new Map(),
		findings: [],
		generatedWithoutLiveAi: true,
		nextRecommendedAction: undefined,
		summary: {
			criticalCount: 0,
			errorCount: 0,
			infoCount: 0,
			totalCount: 0,
			warningCount: 0,
		},
	};
}

export function buildDiagnosticsContext(
	validationContext: ValidationContext,
	affectedDocuments: readonly string[] = [],
	openQuestionIds: readonly string[] = [],
	assumptionIds: readonly string[] = [],
): DiagnosticsContext {
	return {
		...validationContext,
		affectedDocuments: [...new Set(affectedDocuments)],
		assumptionIds: [...new Set(assumptionIds)],
		openQuestionIds: [...new Set(openQuestionIds)],
	};
}

export function convertValidationFindingToDiagnostic(
	finding: ValidationFinding,
): DiagnosticFinding {
	const category = inferDiagnosticCategory(finding.ruleType);

	return {
		affectedDecisionIds: finding.affectedDecisionIds,
		affectedDocuments: finding.affectedDocuments,
		category,
		description: finding.description,
		id: finding.id,
		severity: finding.severity,
		source: 'deterministic',
		suggestedNextAction: finding.suggestedNextAction,
		title: finding.title,
	};
}

function inferDiagnosticCategory(
	ruleType: ValidationFinding['ruleType'],
): DiagnosticCategory {
	switch (ruleType) {
		case 'required_decision':
			return 'gap';
		case 'dependency':
			return 'gap';
		case 'consistency':
			return 'inconsistency';
		case 'risk':
			return 'risk';
		default:
			return 'gap';
	}
}

export function runDeterministicDiagnostics(
	validationResult: ValidationResult,
	diagnosticsContext: DiagnosticsContext,
): DiagnosticsResult {
	const diagnosticFindings = validationResult.findings.map(
		convertValidationFindingToDiagnostic,
	);

	const allAffectedDocuments = [
		...diagnosticsContext.affectedDocuments,
		...validationResult.findings.flatMap((f) => f.affectedDocuments),
	];

	const allAffectedDecisions = [
		...validationResult.findings.flatMap((f) => f.affectedDecisionIds),
	];

	const nextRecommendedAction = buildDeterministicNextAction(validationResult);

	return buildDiagnosticsResult(
		diagnosticFindings,
		allAffectedDocuments,
		allAffectedDecisions,
		nextRecommendedAction,
		true,
	);
}

export async function runDiagnostics(
	rules: Parameters<typeof runValidation>[0],
	riskPatterns: Parameters<typeof runValidation>[1],
	validationContext: ValidationContext,
	diagnosticsContext: DiagnosticsContext,
	options: DiagnosticsOptions = {},
): Promise<DiagnosticsResult> {
	const validationResult = runValidation(
		rules,
		riskPatterns,
		validationContext,
		options.phaseId ? { phaseId: options.phaseId } : undefined,
	);

	const deterministicResult = runDeterministicDiagnostics(
		validationResult,
		diagnosticsContext,
	);

	if (!options.includeAiAnalysis || !options.provider) {
		return {
			...deterministicResult,
			nextRecommendedAction:
				deterministicResult.nextRecommendedAction ??
				buildFallbackNextAction(deterministicResult),
		};
	}

	try {
		const aiContributions = await runAiDiagnostics(
			options.provider,
			validationContext,
			diagnosticsContext,
			validationResult,
		);

		const allFindings = [
			...deterministicResult.findings,
			...aiContributions.map((contrib) => contrib.finding),
		];

		const allAffectedDocuments = [
			...deterministicResult.affectedDocuments,
			...aiContributions.flatMap(
				(contrib) => contrib.finding.affectedDocuments,
			),
		];

		const allAffectedDecisions = [
			...deterministicResult.affectedDecisions,
			...aiContributions.flatMap(
				(contrib) => contrib.finding.affectedDecisionIds,
			),
		];

		const aiNextAction = aiContributions.find(
			(contrib) => contrib.finding.category === 'next_step',
		);

		const nextRecommendedAction =
			aiNextAction?.finding.suggestedNextAction ??
			deterministicResult.nextRecommendedAction ??
			buildFallbackNextAction(deterministicResult);

		return buildDiagnosticsResult(
			allFindings,
			allAffectedDocuments,
			allAffectedDecisions,
			nextRecommendedAction,
			false,
			aiContributions,
		);
	} catch {
		return {
			...deterministicResult,
			nextRecommendedAction:
				deterministicResult.nextRecommendedAction ??
				buildFallbackNextAction(deterministicResult),
		};
	}
}

async function runAiDiagnostics(
	provider: LlmProvider,
	_validationContext: ValidationContext,
	_diagnosticsContext: DiagnosticsContext,
	_validationResult: ValidationResult,
): Promise<readonly AiDiagnosticContribution[]> {
	const contributions: AiDiagnosticContribution[] = [];

	const gapOperation = {
		input: {
			findingCount: _validationResult.summary.totalCount,
			phaseId:
				_diagnosticsContext.openQuestionIds.length > 0
					? 'from_context'
					: undefined,
		},
		messages: [
			{
				content: `Identify gaps in project context. Current findings: ${_validationResult.summary.totalCount}.`,
				role: 'user' as const,
			},
		],
		operationId: 'identify_gaps' as const,
	};

	const riskOperation = {
		input: {
			findingCount: _validationResult.summary.totalCount,
		},
		messages: [
			{
				content: `Identify risks implied by current project context and validation findings.`,
				role: 'user' as const,
			},
		],
		operationId: 'identify_risks' as const,
	};

	const recommendationOperation = {
		input: {
			criticalCount: _validationResult.summary.criticalCount,
			errorCount: _validationResult.summary.errorCount,
		},
		messages: [
			{
				content: `Recommend the next conversational move based on ${
					_validationResult.summary.criticalCount +
					_validationResult.summary.errorCount
				} critical/error findings. Consider which phase needs attention, what questions remain open, and what decisions are missing.`,
				role: 'user' as const,
			},
		],
		operationId: 'recommend_next_conversation_move' as const,
	};

	for (const operation of [
		gapOperation,
		riskOperation,
		recommendationOperation,
	]) {
		try {
			const response = await provider.complete({
				input: operation.input,
				messages: operation.messages,
				operationId: operation.operationId,
				responseFormat: { format: 'json', name: 'logos_ai_operation_output' },
			});

			if (operation.operationId === 'identify_gaps') {
				const output = response.output as {
					gaps?: Array<{
						description: string;
						id: string;
						severity: ValidationSeverity;
					}>;
					status?: string;
					notes?: string[];
				};

				if (output.gaps && Array.isArray(output.gaps)) {
					for (const gap of output.gaps) {
						contributions.push({
							finding: {
								affectedDecisionIds: [],
								affectedDocuments: [],
								category: 'gap',
								description: gap.description,
								id: `ai.gap.${gap.id}`,
								severity: gap.severity ?? 'warning',
								source: 'ai',
								title: `AI Gap: ${gap.id}`,
							},
							operationId: 'identify_gaps',
							status: 'needs_review',
						});
					}
				}
			}

			if (operation.operationId === 'identify_risks') {
				const output = response.output as {
					notes?: string[];
					risks?: Array<{
						description: string;
						id: string;
						severity: ValidationSeverity;
						title: string;
					}>;
					status?: string;
				};

				if (output.risks && Array.isArray(output.risks)) {
					for (const risk of output.risks) {
						contributions.push({
							finding: {
								affectedDecisionIds: [],
								affectedDocuments: [],
								category: 'risk',
								description: risk.description,
								id: `ai.risk.${risk.id}`,
								severity: risk.severity ?? 'warning',
								source: 'ai',
								title: `AI Risk: ${risk.title}`,
							},
							operationId: 'identify_risks',
							status: 'needs_review',
						});
					}
				}
			}

			if (operation.operationId === 'recommend_next_conversation_move') {
				const output = response.output as {
					move?: string;
					phaseId?: string;
					priority?: 'high' | 'medium' | 'low';
					rationale?: string;
					status?: string;
					notes?: string[];
				};

				if (output.move || output.rationale) {
					contributions.push({
						finding: {
							affectedDecisionIds: [],
							affectedDocuments: [],
							category: 'next_step',
							description:
								output.rationale ??
								'Continue the conversation to address gaps.',
							id: 'ai.recommendation.next_conversation_move',
							severity: 'info',
							source: 'ai',
							suggestedNextAction: `Next conversational move: ${output.move ?? 'address open questions'} (phase: ${output.phaseId ?? 'current'}, priority: ${output.priority ?? 'medium'})`,
							title: 'AI Recommendation: Next Conversational Move',
						},
						operationId: 'recommend_next_conversation_move',
						status: 'proposed',
					});
				}
			}
		} catch {
			// Malformed AI diagnostics are handled safely: skip this operation
		}
	}

	return contributions;
}

function buildDeterministicNextAction(
	validationResult: ValidationResult,
): string | undefined {
	if (validationResult.summary.criticalCount > 0) {
		const criticalFindings = validationResult.findings.filter(
			(f) => f.severity === 'critical',
		);
		const firstCritical = criticalFindings[0];
		if (firstCritical?.suggestedNextAction) {
			return firstCritical.suggestedNextAction;
		}
		return `Address ${validationResult.summary.criticalCount} critical issue(s) during your next conversation turn.`;
	}

	if (validationResult.summary.errorCount > 0) {
		const errorFindings = validationResult.findings.filter(
			(f) => f.severity === 'error',
		);
		const firstError = errorFindings[0];
		if (firstError?.suggestedNextAction) {
			return firstError.suggestedNextAction;
		}
		return `Resolve ${validationResult.summary.errorCount} error(s) to unblock progress — continue the conversation to address these.`;
	}

	if (validationResult.summary.warningCount > 0) {
		return `Review ${validationResult.summary.warningCount} warning(s) and address them in your next conversation turn.`;
	}

	if (validationResult.summary.infoCount > 0) {
		return `Review ${validationResult.summary.infoCount} informational note(s). Continue the conversation to fill remaining gaps.`;
	}

	return 'Project looks complete. Run /generate to create documentation.';
}

function buildFallbackNextAction(diagnosticsResult: DiagnosticsResult): string {
	if (diagnosticsResult.summary.criticalCount > 0) {
		return `Address ${diagnosticsResult.summary.criticalCount} critical issue(s) during your next conversation turn.`;
	}

	if (diagnosticsResult.summary.errorCount > 0) {
		return `Resolve ${diagnosticsResult.summary.errorCount} error(s) to unblock progress — continue the conversation to address these.`;
	}

	if (diagnosticsResult.summary.warningCount > 0) {
		return `Review ${diagnosticsResult.summary.warningCount} warning(s) and address them in your next conversation turn.`;
	}

	return 'Project looks complete. Run /generate to create documentation.';
}

function buildDiagnosticsResult(
	findings: readonly DiagnosticFinding[],
	affectedDocuments: readonly string[],
	affectedDecisions: readonly string[],
	nextRecommendedAction: string | undefined,
	generatedWithoutLiveAi: boolean,
	aiContributions: readonly AiDiagnosticContribution[] = [],
): DiagnosticsResult {
	const summary = {
		criticalCount: findings.filter((f) => f.severity === 'critical').length,
		errorCount: findings.filter((f) => f.severity === 'error').length,
		infoCount: findings.filter((f) => f.severity === 'info').length,
		totalCount: findings.length,
		warningCount: findings.filter((f) => f.severity === 'warning').length,
	};

	const bySeverity = new Map<ValidationSeverity, DiagnosticFinding[]>();
	for (const severity of ['critical', 'error', 'warning', 'info'] as const) {
		bySeverity.set(
			severity,
			findings.filter((f) => f.severity === severity),
		);
	}

	const byCategory = new Map<DiagnosticCategory, DiagnosticFinding[]>();
	for (const category of [
		'gap',
		'risk',
		'inconsistency',
		'next_step',
		'weak_document',
	] as const) {
		byCategory.set(
			category,
			findings.filter((f) => f.category === category),
		);
	}

	return {
		affectedDecisions: [...new Set(affectedDecisions)],
		affectedDocuments: [...new Set(affectedDocuments)],
		aiContributions,
		byCategory,
		bySeverity,
		findings,
		generatedWithoutLiveAi,
		nextRecommendedAction,
		summary,
	};
}
