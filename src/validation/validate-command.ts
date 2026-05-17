/** Step 6.3 — Validate command orchestrator. Deterministic, AI-free. */

import { resolve } from 'node:path';
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
import { lintCanonicalMarkdownDocuments } from './document-semantic-lints.js';
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
import type {
	ValidationFinding,
	ValidationGateStatus,
	ValidationScope,
} from './validation-finding.js';
import { summarizeValidationFindings } from './validation-finding.js';
import { validateWorkspace } from './validation-service.js';

export type ValidateCommandMode = 'execute' | 'dry_run';

export type ValidateCommandScope = ValidationScope;

export interface ValidateCommandOptions {
	mode?: ValidateCommandMode | undefined;
	projectRoot: string;
	scopes?: ValidationScope[] | undefined;
	idFactory?: (() => string) | undefined;
	clock?: { now(): string } | undefined;
	reportFormat?: ValidationReportFormat | undefined;
	reportWritePolicy?: ValidationReportWritePolicy | undefined;
	skipReportGeneration?: boolean | undefined;
}

export interface ValidateCommandData {
	mode: ValidateCommandMode;
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
	sourceCounts: Record<string, number>;
	topFindings: Array<{
		severity: string;
		code: string;
		message: string;
		path?: string | undefined;
	}>;
	recoveryHints: string[];
	changedPaths: string[];
	dryRun: boolean;
	reportSummary?: ValidationReportSummary | undefined;
	reportFormat?: ValidationReportFormat | undefined;
}

function fallbackIdFactory(): string {
	return `val-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function fallbackClock(): { now(): string } {
	return { now: () => new Date().toISOString() };
}

function normalizeScopes(scopes?: ValidationScope[]): ValidationScope[] {
	const requested = scopes?.length ? scopes : ['all'];
	if (requested.includes('all'))
		return ['contracts', 'state', 'artifacts', 'outputs'];
	const order: ValidationScope[] = [
		'contracts',
		'state',
		'artifacts',
		'outputs',
	];
	return order.filter((s) => requested.includes(s));
}

function collectRecoveryHints(findings: ValidationFinding[]): string[] {
	const seen = new Set<string>();
	const hints: string[] = [];
	for (const f of findings) {
		if (f.recoveryHint?.message && !seen.has(f.recoveryHint.message)) {
			seen.add(f.recoveryHint.message);
			hints.push(f.recoveryHint.message);
		}
	}
	return hints;
}

function getTopFindings(
	findings: ValidationFinding[],
	limit: number,
): Array<{
	severity: string;
	code: string;
	message: string;
	path?: string | undefined;
}> {
	return findings.slice(0, limit).map((f) => ({
		code: f.code,
		message: f.message,
		path: f.location.path,
		severity: f.severity,
	}));
}

function findDefaultDocumentationRoot(rootPath: string | undefined): string {
	if (!rootPath || rootPath === 'docs/' || rootPath === 'docs') return 'logos/';
	return rootPath.endsWith('/') ? rootPath : `${rootPath}/`;
}

async function collectMarkdownLintInputs(
	projectRoot: string,
	stateResult: Awaited<ReturnType<typeof readWorkspaceState>>,
): Promise<
	Array<{
		markdown: string;
		documentCanonicalId: string;
		phaseId: string;
		path: string;
	}>
> {
	const result: Array<{
		markdown: string;
		documentCanonicalId: string;
		phaseId: string;
		path: string;
	}> = [];
	if (!stateResult.state) return result;

	for (const artifact of stateResult.state.artifacts) {
		if (
			artifact.artifactType === 'canonical_markdown' &&
			artifact.status === 'generated'
		) {
			const docId = artifact.sourceDocumentIds[0] ?? artifact.artifactId;
			const phaseId = (artifact.metadata?.phaseId as string | undefined) ?? '';
			result.push({
				documentCanonicalId: docId,
				markdown: '',
				path: artifact.path,
				phaseId: phaseId ?? '',
			});
		}
	}

	if (result.length === 0) return result;

	const { readFile, access } = await import('node:fs/promises');
	const resolvedItems: Array<{
		markdown: string;
		documentCanonicalId: string;
		phaseId: string;
		path: string;
	}> = [];

	for (const item of result) {
		const fullPath = resolve(projectRoot, item.path);
		try {
			await access(fullPath);
			const content = await readFile(fullPath, 'utf-8');
			resolvedItems.push({ ...item, markdown: content, path: fullPath });
		} catch {
			// File not found — validation service already flags this
		}
	}

	return resolvedItems;
}

export async function runValidateCommand(
	options: ValidateCommandOptions,
): Promise<CommandResult<ValidateCommandData>> {
	const mode: ValidateCommandMode = options.mode ?? 'execute';
	const dryRun = mode === 'dry_run';
	const idFactory = options.idFactory ?? fallbackIdFactory;
	const clock = options.clock ?? fallbackClock();
	const projectRoot = resolve(options.projectRoot);
	const scopes = normalizeScopes(options.scopes);
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
	const contractOnly = scopes.length === 1 && scopes[0] === 'contracts';

	if (!hasWorkspace && !contractOnly) {
		return createCommandResult<ValidateCommandData>({
			command: '/validate',
			data: {
				activeProfileId: profileId,
				changedPaths: [],
				documentationRoot: docRoot,
				dryRun,
				findingCounts: { error: 0, fatal: 0, info: 0, total: 0, warning: 0 },
				gateStatus: 'fail',
				mode,
				projectRoot,
				recoveryHints: [
					'Run /init to initialize the LOGOS workspace, or run /validate --scope contracts for contract-only validation.',
				],
				scopesChecked: scopes,
				sourceCounts: {},
				topFindings: [],
			},
			dryRun,
			errors: [
				{
					code: 'workspace_missing',
					message:
						'Cannot run full validation without an initialized workspace.',
					path: projectRoot,
					pointer: '/projectRoot',
					recoveryHint:
						'Run /init to initialize the workspace, or use --scope contracts.',
					severity: 'error',
				},
			],
			messages: [],
			status: 'error',
			warnings: [],
		});
	}

	const validationResult = await validateWorkspace(
		{
			documentationRoot: docRoot,
			profileId,
			projectRoot,
			scopes,
		},
		{ dryRun: true, scopes },
	);

	let semanticLintFindings: ValidationFinding[] = [];

	if (scopes.some((s) => s === 'outputs' || s === 'all')) {
		try {
			const lintInputs = await collectMarkdownLintInputs(
				projectRoot,
				stateResult,
			);
			if (lintInputs.length > 0) {
				const lintResult = lintCanonicalMarkdownDocuments(lintInputs, {});
				semanticLintFindings = lintResult.findings;
			}
		} catch {
			// Semantic linting is best-effort
		}
	}

	const allFindings = [...validationResult.findings, ...semanticLintFindings];
	const summary = summarizeValidationFindings(allFindings);
	const gateStatus = validationResult.status;

	if (dryRun) {
		const topFindings = getTopFindings(allFindings, 20);
		const recoveryHints = collectRecoveryHints(allFindings);
		const findingCodeCounts: Record<string, number> = {};
		for (const f of allFindings) {
			findingCodeCounts[f.source.kind] =
				(findingCodeCounts[f.source.kind] ?? 0) + 1;
		}

		return createCommandResult<ValidateCommandData>({
			changedPaths: [],
			command: '/validate',
			data: {
				activeProfileId: profileId,
				changedPaths: [],
				documentationRoot: docRoot,
				dryRun: true,
				findingCounts: {
					error: summary.bySeverity.error,
					fatal: summary.bySeverity.fatal,
					info: summary.bySeverity.info,
					total: summary.totalFindings,
					warning: summary.bySeverity.warning,
				},
				gateStatus,
				mode: 'dry_run',
				projectRoot,
				recoveryHints,
				scopesChecked: scopes,
				sourceCounts: findingCodeCounts,
				topFindings,
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
			reportKind: 'validation',
			runId,
		});

		const recoveryHints = collectRecoveryHints(allFindings);
		const reportParams = {
			activeProfileId: profileId,
			aiInterpretationSource: undefined as string | undefined,
			changedPaths: runChangedPaths,
			diagnostics: validationResult.diagnostics.map((d) => d.message),
			documentationRoot: docRoot,
			dryRun: false,
			findings: allFindings,
			gateStatus,
			generatedAt: completedAt,
			projectRoot,
			recoveryHints,
			reportId: reportId ?? '',
			reportKind: 'validation' as const,
			runId,
			scopesChecked: scopes,
			summary,
			title: 'Validation Report',
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
				reportKind: 'validation',
				runId,
				totalFindings: allFindings.length,
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
							reportId,
							reportKind: 'validation',
							runId,
							totalFindings: allFindings.length,
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
						command: '/validate',
						completedAt,
						dryRun: false,
						findingIds: allFindings.map((f) => f.id),
						relatedArtifactIds,
						runType: 'validation',
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
							message: 'Failed to persist validation run metadata.',
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

	const topFindings = getTopFindings(allFindings, 20);
	const recoveryHints = collectRecoveryHints(allFindings);

	const findingCodeCounts: Record<string, number> = {};
	for (const f of allFindings) {
		findingCodeCounts[f.source.kind] =
			(findingCodeCounts[f.source.kind] ?? 0) + 1;
	}

	const isPass = gateStatus === 'pass' || gateStatus === 'pass_with_warnings';

	return createCommandResult<ValidateCommandData>({
		changedPaths,
		command: '/validate',
		data: {
			activeProfileId: profileId,
			changedPaths: changedPaths.map((p) => p.path),
			documentationRoot: docRoot,
			dryRun,
			findingCounts: {
				error: summary.bySeverity.error,
				fatal: summary.bySeverity.fatal,
				info: summary.bySeverity.info,
				total: summary.totalFindings,
				warning: summary.bySeverity.warning,
			},
			gateStatus,
			mode,
			projectRoot,
			recoveryHints,
			reportFormat: reportId ? reportFormat : undefined,
			reportId,
			reportPath,
			reportSummary,
			runId,
			scopesChecked: scopes,
			sourceCounts: findingCodeCounts,
			topFindings,
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
				text: `Validation gate: ${gateStatus.toUpperCase()}`,
			},
		],
		status: isPass ? 'success' : 'warning',
		warnings: [],
	});
}
