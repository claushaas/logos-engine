/** Step 6.3 — Diagnostic command orchestrator. Deterministic findings + optional AI interpretation. */

import { resolve } from 'node:path';
import { checkProviderDisclosure } from '../ai/provider-disclosure.js';
import type { AiProviderPort } from '../ai/provider-port.js';
import { writeFileAtomic } from '../fs/safe-filesystem.js';
import {
	type CommandChangedPath,
	type CommandResult,
	createCommandResult,
} from '../runtime/command-result.js';
import {
	createStructuredError,
	type StructuredError,
} from '../runtime/errors.js';
import { registerArtifact } from '../state/artifact-registry.js';
import { createRunRecord } from '../state/run-repository.js';
import {
	readWorkspaceState,
	writeWorkspaceState,
} from '../state/workspace-state-repository.js';
import {
	computeReportChecksum,
	createReportSummary,
	planReportPath,
	renderValidationReportJson,
	renderValidationReportMarkdown,
	type ValidationReportFormat,
	type ValidationReportSummary,
	type ValidationReportWritePolicy,
} from './review-report.js';
import { runValidateCommand } from './validate-command.js';
import type {
	ValidationFinding,
	ValidationFindingSeverity,
	ValidationGateStatus,
	ValidationScope,
} from './validation-finding.js';
import {
	determineValidationGateStatus,
	sortValidationFindings,
	summarizeValidationFindings,
} from './validation-finding.js';

export type DiagnoseCommandMode = 'execute' | 'dry_run';

export type DiagnosticInterpretationSource =
	| 'none'
	| 'deterministic'
	| 'fake_provider'
	| 'remote_provider';

export interface DiagnosticInterpretation {
	source: DiagnosticInterpretationSource;
	explanations: DiagnosticExplanation[];
	groupedFindings: DiagnosticFindingGroup[];
	suggestedActions: DiagnosticSuggestedAction[];
	fallbackReason?: string | undefined;
}

export interface DiagnosticExplanation {
	text: string;
	findingIds: string[];
}

export interface DiagnosticSuggestedAction {
	text: string;
	priority: 'high' | 'medium' | 'low';
	category: string;
}

export interface DiagnosticFindingGroup {
	label: string;
	findingIds: string[];
	reason: string;
}

export interface DiagnoseCommandOptions {
	mode?: DiagnoseCommandMode | undefined;
	projectRoot: string;
	scopes?: ValidationScope[] | undefined;
	idFactory?: (() => string) | undefined;
	clock?: { now(): string } | undefined;
	reportFormat?: ValidationReportFormat | undefined;
	reportWritePolicy?: ValidationReportWritePolicy | undefined;
	skipReportGeneration?: boolean | undefined;
	provider?: AiProviderPort | undefined;
}

export interface DiagnoseCommandData {
	mode: DiagnoseCommandMode;
	runId?: string | undefined;
	reportId?: string | undefined;
	reportPath?: string | undefined;
	gateStatus: ValidationGateStatus;
	scopesChecked: ValidationScope[];
	projectRoot: string;
	documentationRoot: string;
	activeProfileId: string;
	findingCounts: {
		fatal: number;
		error: number;
		warning: number;
		info: number;
		total: number;
	};
	interpretationSource: DiagnosticInterpretationSource;
	explanations: DiagnosticExplanation[];
	groupedFindings: DiagnosticFindingGroup[];
	suggestedActions: DiagnosticSuggestedAction[];
	fallbackReason?: string | undefined;
	recoveryHints: string[];
	changedPaths: string[];
	dryRun: boolean;
	reportSummary?: ValidationReportSummary | undefined;
}

function fallbackIdFactory(): string {
	return `diag-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function fallbackClock(): { now(): string } {
	return { now: () => new Date().toISOString() };
}

function groupFindingsDeterministically(
	findings: ValidationFinding[],
): DiagnosticFindingGroup[] {
	const groups: DiagnosticFindingGroup[] = [];

	const bySeverity: Record<ValidationFindingSeverity, ValidationFinding[]> = {
		error: [],
		fatal: [],
		info: [],
		warning: [],
	};
	for (const f of findings) {
		bySeverity[f.severity].push(f);
	}

	const severityOrder: ValidationFindingSeverity[] = [
		'fatal',
		'error',
		'warning',
		'info',
	];
	const severityLabels: Record<string, string> = {
		error: 'Errors',
		fatal: 'Fatal Issues',
		info: 'Info',
		warning: 'Warnings',
	};

	for (const severity of severityOrder) {
		const items = bySeverity[severity];
		if (items && items.length > 0) {
			groups.push({
				findingIds: items.map((f) => f.id),
				label: `${severityLabels[severity] ?? severity} (${items.length})`,
				reason: `${items.length} finding(s) at ${severity} severity found during validation.`,
			});

			const bySource: Record<string, ValidationFinding[]> = {};
			for (const f of items) {
				const key = f.source.kind;
				if (!bySource[key]) bySource[key] = [];
				bySource[key].push(f);
			}
			for (const [source, srcItems] of Object.entries(bySource)) {
				if (srcItems.length > 1) {
					groups.push({
						findingIds: srcItems.map((f) => f.id),
						label: `  ${source} (${srcItems.length} ${severity})`,
						reason: `${srcItems.length} ${severity}-level finding(s) from ${source} source.`,
					});
				}
			}
		}
	}

	return groups;
}

function generateDeterministicExplanations(
	findings: ValidationFinding[],
): DiagnosticExplanation[] {
	const explanations: DiagnosticExplanation[] = [];

	if (findings.length === 0) {
		explanations.push({
			findingIds: [],
			text: 'No validation findings were detected. All checks passed deterministically.',
		});
		return explanations;
	}

	const fatalErrors = findings.filter(
		(f) => f.severity === 'fatal' || f.severity === 'error',
	);
	if (fatalErrors.length > 0) {
		explanations.push({
			findingIds: fatalErrors.map((f) => f.id),
			text: `${fatalErrors.length} fatal or error-level finding(s) were detected. These must be resolved to pass the validation gate.`,
		});
	}

	const warnings = findings.filter((f) => f.severity === 'warning');
	if (warnings.length > 0) {
		explanations.push({
			findingIds: warnings.map((f) => f.id),
			text: `${warnings.length} warning-level finding(s) were detected. The gate will pass with warnings, but review is recommended.`,
		});
	}

	const infos = findings.filter((f) => f.severity === 'info');
	if (infos.length > 0) {
		explanations.push({
			findingIds: infos.map((f) => f.id),
			text: `${infos.length} info-level finding(s) were detected. These are informational and do not affect gate status.`,
		});
	}

	const byKind: Record<string, ValidationFinding[]> = {};
	for (const f of findings) {
		const key = f.source.kind;
		if (!byKind[key]) byKind[key] = [];
		byKind[key].push(f);
	}

	for (const [kind, items] of Object.entries(byKind)) {
		if (items.length >= 3) {
			explanations.push({
				findingIds: items.map((f) => f.id),
				text: `${items.length} finding(s) originate from ${kind}. Consider reviewing ${kind} configuration or generated output in that area.`,
			});
		}
	}

	return explanations;
}

function generateDeterministicActions(
	findings: ValidationFinding[],
	gateStatus: ValidationGateStatus,
): DiagnosticSuggestedAction[] {
	const actions: DiagnosticSuggestedAction[] = [];

	if (findings.length === 0) {
		actions.push({
			category: 'status',
			priority: 'low',
			text: 'Run /status to review workspace state.',
		});
		actions.push({
			category: 'next',
			priority: 'low',
			text: 'Run /continue to proceed with the next intake question cluster.',
		});
		return actions;
	}

	actions.push({
		category: 'status',
		priority: 'high',
		text: 'Run /status to review current workspace state, runs, and artifacts.',
	});

	if (
		findings.some(
			(f) =>
				f.code === 'output_metadata_missing' ||
				f.code === 'output_metadata_invalid',
		)
	) {
		actions.push({
			category: 'generation',
			priority: 'high',
			text: 'Run /generate --confirm to regenerate canonical Markdown documentation.',
		});
	}

	const workspaceIssues = findings.filter(
		(f) => f.source.kind === 'workspace_state' || f.code.includes('workspace'),
	);
	if (workspaceIssues.length > 0) {
		actions.push({
			category: 'workspace',
			priority: 'high',
			text: 'Review and repair workspace state. Run /status for details.',
		});
	}

	const contractIssues = findings.filter(
		(f) =>
			f.source.kind === 'profile_registry' ||
			f.source.kind === 'document_descriptor' ||
			f.source.kind === 'contract_graph',
	);
	if (contractIssues.length > 0) {
		actions.push({
			category: 'contracts',
			priority: 'high',
			text: 'Review profile, phase, and document descriptors for contract issues.',
		});
	}

	const secretIssues = findings.filter(
		(f) => f.code === 'secret_like_value' || f.source.kind === 'secret_scan',
	);
	if (secretIssues.length > 0) {
		actions.push({
			category: 'security',
			priority: 'high',
			text: 'Replace raw secret-like values with environment variable names.',
		});
	}

	const pathIssues = findings.filter(
		(f) => f.code === 'path_traversal' || f.code === 'workspace_root_invalid',
	);
	if (pathIssues.length > 0) {
		actions.push({
			category: 'paths',
			priority: 'high',
			text: 'Fix path declarations to stay within allowed roots (logos/, project root).',
		});
	}

	if (gateStatus === 'fail') {
		actions.push({
			category: 'resolution',
			priority: 'high',
			text: 'Resolve all error and fatal findings, then rerun /validate.',
		});
	} else {
		actions.push({
			category: 'resolution',
			priority: 'medium',
			text: 'Rerun /validate to confirm resolution of findings.',
		});
	}

	return actions;
}

function renderAiInterpretationSection(
	interpretation: DiagnosticInterpretation,
): string {
	const lines: string[] = [];

	if (interpretation.source === 'none') return '';
	if (interpretation.source === 'deterministic') {
		lines.push('### Deterministic Diagnosis');
		lines.push('');
	}

	if (interpretation.fallbackReason) {
		lines.push(`> **Fallback Reason:** ${interpretation.fallbackReason}`);
		lines.push('');
	}

	if (interpretation.explanations.length > 0) {
		lines.push('#### Explanations');
		lines.push('');
		for (const exp of interpretation.explanations) {
			lines.push(`- ${exp.text}`);
		}
		lines.push('');
	}

	if (interpretation.groupedFindings.length > 0) {
		lines.push('#### Finding Groups');
		lines.push('');
		for (const group of interpretation.groupedFindings) {
			lines.push(`**${group.label}**`);
			lines.push(`- ${group.reason}`);
			lines.push(`- Affected findings: ${group.findingIds.join(', ')}`);
			lines.push('');
		}
	}

	if (interpretation.suggestedActions.length > 0) {
		lines.push('#### Suggested Actions');
		lines.push('');
		for (const action of interpretation.suggestedActions) {
			lines.push(
				`- [${action.priority.toUpperCase()}] [${action.category}] ${action.text}`,
			);
		}
		lines.push('');
	}

	return lines.join('\n');
}

async function attemptAiInterpretation(
	findings: ValidationFinding[],
	provider: AiProviderPort,
): Promise<{
	interpretation: DiagnosticInterpretation;
	succeeded: boolean;
}> {
	try {
		const disclosureResult = checkProviderDisclosure({
			consent: 'absent',
			contextCategories: ['workspace_validation_gaps', 'artifact_metadata'],
			contextCategorySummary: { findings: findings.length },
			providerId: provider.providerId,
			providerKind: provider.providerKind,
		});

		if (!disclosureResult.allowed && provider.providerKind === 'remote') {
			return {
				interpretation: {
					explanations: [],
					fallbackReason:
						'Remote provider disclosure is required but not available.',
					groupedFindings: [],
					source: 'deterministic',
					suggestedActions: [],
				},
				succeeded: false,
			};
		}

		const findingSummaries = findings.map((f) => ({
			code: f.code,
			message: f.message,
			severity: f.severity,
			source: f.source.kind,
		}));

		const response = await provider.conversation({
			contextCategorySummary: { findings: findings.length },
			executionMode: 'inline',
			messages: [
				{
					content: `You are a documentation quality analyst. You are given a list of validation findings from a deterministic validation pipeline. Your job is to:
1. Group related findings by theme
2. Explain each group in plain language
3. Suggest specific next actions

Do NOT:
- Change the severity of any finding
- Remove or add findings
- Claim the validation passed if it failed
- Generate any canonical documentation

Validation findings:
${JSON.stringify(findingSummaries, null, 2)}`,
					role: 'system',
				},
				{
					content:
						'Please analyze these validation findings and provide: 1) Explanation in plain language, 2) Related finding groups, 3) Suggested next actions.',
					role: 'user',
				},
			],
			operation: 'conversation',
			providerId: provider.providerId,
			providerKind: provider.providerKind,
		});

		if (response.status !== 'success') {
			return {
				interpretation: {
					explanations: [],
					fallbackReason: 'Provider returned non-success status.',
					groupedFindings: [],
					source: 'deterministic',
					suggestedActions: [],
				},
				succeeded: false,
			};
		}

		return {
			interpretation: {
				explanations: [
					{
						findingIds: findings.map((f) => f.id),
						text: 'AI interpretation completed through the configured provider. Raw provider responses are not persisted; deterministic findings, groups, suggested actions, and gate status remain authoritative.',
					},
				],
				groupedFindings: [],
				source:
					provider.providerKind === 'fake'
						? 'fake_provider'
						: 'remote_provider',
				suggestedActions: [],
			},
			succeeded: true,
		};
	} catch {
		return {
			interpretation: {
				explanations: [],
				fallbackReason: 'AI interpretation threw an error.',
				groupedFindings: [],
				source: 'deterministic',
				suggestedActions: [],
			},
			succeeded: false,
		};
	}
}

function findDefaultDocumentationRoot(rootPath: string | undefined): string {
	if (!rootPath || rootPath === 'docs/' || rootPath === 'docs') return 'logos/';
	return rootPath.endsWith('/') ? rootPath : `${rootPath}/`;
}

export async function runDiagnoseCommand(
	options: DiagnoseCommandOptions,
): Promise<CommandResult<DiagnoseCommandData>> {
	const mode: DiagnoseCommandMode = options.mode ?? 'execute';
	const dryRun = mode === 'dry_run';
	const idFactory = options.idFactory ?? fallbackIdFactory;
	const clock = options.clock ?? fallbackClock();
	const projectRoot = resolve(options.projectRoot);
	const errors: StructuredError[] = [];
	const changedPaths: CommandChangedPath[] = [];

	const stateResult = await readWorkspaceState({ projectRoot });
	let docRoot = 'logos/';
	let profileId = 'standard';

	if (stateResult.success && stateResult.state) {
		docRoot = findDefaultDocumentationRoot(
			stateResult.state.documentation.rootPath,
		);
		profileId = stateResult.state.profile.profileId;
	}

	const hasWorkspace = stateResult.success && stateResult.state !== undefined;

	if (!hasWorkspace) {
		return createCommandResult<DiagnoseCommandData>({
			command: '/diagnose',
			data: {
				activeProfileId: profileId,
				changedPaths: [],
				documentationRoot: docRoot,
				dryRun,
				explanations: [],
				fallbackReason: 'No workspace available for diagnosis.',
				findingCounts: { error: 0, fatal: 0, info: 0, total: 0, warning: 0 },
				gateStatus: 'fail',
				groupedFindings: [],
				interpretationSource: 'deterministic',
				mode,
				projectRoot,
				recoveryHints: ['Run /init to initialize the LOGOS workspace.'],
				scopesChecked:
					options.scopes && options.scopes.length > 0
						? options.scopes
						: ['contracts', 'state', 'artifacts', 'outputs'],
				suggestedActions: [
					{
						category: 'workspace',
						priority: 'high',
						text: 'Run /init to initialize the LOGOS workspace.',
					},
				],
			},
			dryRun,
			errors: [
				{
					code: 'workspace_missing',
					message: 'Cannot run diagnosis without an initialized workspace.',
					path: projectRoot,
					pointer: '/projectRoot',
					recoveryHint: 'Run /init to initialize the workspace.',
					severity: 'error',
				},
			],
			messages: [],
			status: 'error',
			warnings: [],
		});
	}

	const validateResult = await runValidateCommand({
		clock,
		idFactory,
		mode: 'execute',
		projectRoot,
		reportFormat: options.reportFormat,
		reportWritePolicy: options.reportWritePolicy,
		scopes: options.scopes,
		skipReportGeneration: true,
	});

	const validateData = validateResult.data;
	const _allFindings = validateData.topFindings;

	const _fullFindings: ValidationFinding[] = [];
	// We need the actual finding objects from the validation service for proper diagnosis
	// Re-run the underlying validation to get full finding objects
	const { validateWorkspace } = await import('./validation-service.js');
	const { lintCanonicalMarkdownDocuments } = await import(
		'./document-semantic-lints.js'
	);
	const validationResult = await validateWorkspace(
		{
			documentationRoot: docRoot,
			profileId,
			projectRoot,
			scopes: options.scopes,
		},
		{ dryRun: true, scopes: options.scopes },
	);

	let semanticLintFindings: ValidationFinding[] = [];
	if (stateResult.state) {
		const lintInputs: Array<{
			markdown: string;
			documentCanonicalId: string;
			phaseId: string;
			path: string;
		}> = [];
		for (const artifact of stateResult.state.artifacts) {
			if (
				artifact.artifactType === 'canonical_markdown' &&
				artifact.status === 'generated'
			) {
				const docId = artifact.sourceDocumentIds[0] ?? artifact.artifactId;
				const phaseId =
					(artifact.metadata?.phaseId as string | undefined) ?? '';
				try {
					const { readFile, access } = await import('node:fs/promises');
					const fullPath = resolve(projectRoot, artifact.path);
					await access(fullPath);
					const content = await readFile(fullPath, 'utf-8');
					lintInputs.push({
						documentCanonicalId: docId,
						markdown: content,
						path: fullPath,
						phaseId,
					});
				} catch {
					// skip
				}
			}
		}
		if (lintInputs.length > 0) {
			const lintResult = lintCanonicalMarkdownDocuments(lintInputs, {});
			semanticLintFindings = lintResult.findings;
		}
	}

	const allFullFindings = sortValidationFindings([
		...validationResult.findings,
		...semanticLintFindings,
	]);
	const fullSummary = summarizeValidationFindings(allFullFindings);
	const gateStatus = determineValidationGateStatus(allFullFindings);

	const deterministicInterpretation: DiagnosticInterpretation = {
		explanations: generateDeterministicExplanations(allFullFindings),
		groupedFindings: groupFindingsDeterministically(allFullFindings),
		source: 'deterministic',
		suggestedActions: generateDeterministicActions(allFullFindings, gateStatus),
	};

	let interpretation: DiagnosticInterpretation = deterministicInterpretation;
	let aiSucceeded = false;

	if (options.provider) {
		const aiResult = await attemptAiInterpretation(
			allFullFindings,
			options.provider,
		);
		if (aiResult.succeeded) {
			interpretation = {
				explanations: aiResult.interpretation.explanations,
				groupedFindings: [
					...deterministicInterpretation.groupedFindings,
					...aiResult.interpretation.groupedFindings,
				],
				source: aiResult.interpretation.source,
				suggestedActions: [
					...deterministicInterpretation.suggestedActions,
					...aiResult.interpretation.suggestedActions,
				],
			};
			aiSucceeded = true;
		} else {
			interpretation = {
				...deterministicInterpretation,
				fallbackReason: aiResult.interpretation.fallbackReason,
			};
		}
	}

	if (dryRun) {
		return createCommandResult<DiagnoseCommandData>({
			changedPaths: [],
			command: '/diagnose',
			data: {
				activeProfileId: profileId,
				changedPaths: [],
				documentationRoot: docRoot,
				dryRun: true,
				explanations: interpretation.explanations,
				fallbackReason: interpretation.fallbackReason,
				findingCounts: {
					error: fullSummary.bySeverity.error,
					fatal: fullSummary.bySeverity.fatal,
					info: fullSummary.bySeverity.info,
					total: fullSummary.totalFindings,
					warning: fullSummary.bySeverity.warning,
				},
				gateStatus,
				groupedFindings: interpretation.groupedFindings,
				interpretationSource: interpretation.source,
				mode: 'dry_run',
				projectRoot,
				recoveryHints: validateData.recoveryHints,
				scopesChecked: validateData.scopesChecked,
				suggestedActions: interpretation.suggestedActions,
			},
			dryRun: true,
			errors: [],
			messages: [],
			status: gateStatus === 'fail' ? 'warning' : 'success',
			warnings: [],
		});
	}

	const runId = idFactory();
	const startedAt = clock.now();
	const completedAt = clock.now();
	const reportFormat: ValidationReportFormat =
		options.reportFormat ?? 'markdown';
	const runChangedPaths: string[] = [];
	let reportId: string | undefined;
	let reportPath: string | undefined;
	let reportSummary: ValidationReportSummary | undefined;
	const relatedArtifactIds: string[] = [];

	if (!options.skipReportGeneration) {
		const reportGenId = idFactory();
		reportId = `rpt-${reportGenId}`;
		const { path: plannedPath } = planReportPath({
			documentationRoot: docRoot,
			format: reportFormat,
			projectRoot,
			reportKind: 'diagnostic',
			runId,
		});

		const aiSection = renderAiInterpretationSection(interpretation);

		const reportParams = {
			activeProfileId: profileId,
			aiInterpretationSection: aiSection || undefined,
			aiInterpretationSource: aiSucceeded ? interpretation.source : undefined,
			changedPaths: runChangedPaths,
			diagnostics: validationResult.diagnostics.map((d) => d.message),
			documentationRoot: docRoot,
			dryRun: false,
			findings: allFullFindings,
			gateStatus,
			generatedAt: completedAt,
			projectRoot,
			recoveryHints: validateData.recoveryHints,
			reportId: reportId ?? '',
			reportKind: 'diagnostic' as const,
			runId,
			scopesChecked: validateData.scopesChecked,
			summary: fullSummary,
			title: 'Diagnostic Report',
		};

		const content =
			reportFormat === 'json'
				? renderValidationReportJson(reportParams)
				: renderValidationReportMarkdown(reportParams);
		const checksum = computeReportChecksum(content);

		const fullPath = resolve(projectRoot, plannedPath);
		const writeResult = await writeFileAtomic(fullPath, content, {
			allowedBaseDir: projectRoot,
			dryRun: false,
			enableSecretRedaction: true,
			policy: options.reportWritePolicy ?? 'create_only',
		});

		if (writeResult.success) {
			reportPath = plannedPath;
			for (const cp of writeResult.changedPaths) {
				runChangedPaths.push(cp.path);
				changedPaths.push({
					action:
						cp.role === 'file_created' || cp.role === 'directory_created'
							? 'created'
							: 'modified',
					path: cp.path,
				});
			}

			reportSummary = createReportSummary({
				changedPaths: runChangedPaths,
				checksum,
				format: reportFormat,
				gateStatus,
				generatedAt: completedAt,
				path: plannedPath,
				reportId: reportId ?? '',
				reportKind: 'diagnostic',
				runId,
				totalFindings: allFullFindings.length,
			});

			if (stateResult.success && stateResult.state) {
				const registerOptions: Parameters<typeof registerArtifact>[0] = {
					input: {
						artifactType: 'report',
						checksum,
						generatedAt: completedAt,
						isCanonical: false,
						metadata: {
							format: reportFormat,
							gateStatus,
							interpretationSource: interpretation.source,
							reportId,
							reportKind: 'diagnostic',
							runId,
							totalFindings: allFullFindings.length,
						},
						path: plannedPath,
						runId,
						sourceDocumentIds: [],
						status: 'generated',
					},
					state: stateResult.state,
				};
				if (options.idFactory) registerOptions.idFactory = options.idFactory;
				const artifactResult = registerArtifact(registerOptions);
				relatedArtifactIds.push(artifactResult.artifact.artifactId);

				const runInput: Parameters<typeof createRunRecord>[0] = {
					input: {
						changedPaths: runChangedPaths,
						command: '/diagnose',
						completedAt,
						dryRun: false,
						findingIds: allFullFindings.map((f) => f.id),
						relatedArtifactIds,
						runType: 'diagnostic',
						startedAt,
						status: 'completed',
					},
					state: artifactResult.state,
				};
				if (options.idFactory) runInput.idFactory = options.idFactory;
				if (options.clock) runInput.clock = clock;
				const runCreateResult = createRunRecord(runInput);

				const writeStateResult = await writeWorkspaceState({
					dryRun: false,
					policy: 'overwrite',
					projectRoot,
					state: runCreateResult.state,
				});

				if (writeStateResult.success) {
					for (const p of writeStateResult.changedPaths) {
						changedPaths.push({
							action: 'modified',
							path: p,
						});
					}
				} else {
					errors.push(
						createStructuredError({
							code: 'state_write_failed',
							message: 'Failed to persist diagnostic run metadata.',
							recoveryHint: 'Check filesystem permissions and disk space.',
						}),
					);
				}
			}
		} else {
			for (const diag of writeResult.diagnostics) {
				errors.push(
					createStructuredError({
						code: diag.code,
						message: diag.message,
						recoveryHint: diag.recoveryHint,
					}),
				);
			}
		}
	}

	const isPass = gateStatus === 'pass' || gateStatus === 'pass_with_warnings';

	return createCommandResult<DiagnoseCommandData>({
		changedPaths,
		command: '/diagnose',
		data: {
			activeProfileId: profileId,
			changedPaths: changedPaths.map((p) => p.path),
			documentationRoot: docRoot,
			dryRun,
			explanations: interpretation.explanations,
			fallbackReason: interpretation.fallbackReason,
			findingCounts: {
				error: fullSummary.bySeverity.error,
				fatal: fullSummary.bySeverity.fatal,
				info: fullSummary.bySeverity.info,
				total: fullSummary.totalFindings,
				warning: fullSummary.bySeverity.warning,
			},
			gateStatus,
			groupedFindings: interpretation.groupedFindings,
			interpretationSource: interpretation.source,
			mode,
			projectRoot,
			recoveryHints: validateData.recoveryHints,
			reportId,
			reportPath,
			reportSummary,
			runId,
			scopesChecked: validateData.scopesChecked,
			suggestedActions: interpretation.suggestedActions,
		},
		dryRun,
		errors: errors.map((e) => ({
			code: e.code,
			message: e.message,
			path: e.path,
			pointer: e.pointer,
			recoveryHint: e.recoveryHint,
			severity: e.severity,
		})),
		messages: [
			{
				level: isPass ? 'success' : 'info',
				text: `Diagnostic gate: ${gateStatus.toUpperCase()}`,
			},
		],
		status: isPass ? 'success' : 'warning',
		warnings: [],
	});
}
