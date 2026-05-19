/** Step 11.4 — Executive Compile Workflow Service */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, normalize, resolve } from 'node:path';
import { buildDocumentDependencyGraph } from '../dependency-graph/index.js';
import {
	type CanonicalDocumentId,
	loadDocumentationContract,
} from '../profiles/documentation-contract.js';
import { loadProfileRegistry } from '../profiles/profile-registry.js';
import { registerArtifact } from '../state/artifact-registry.js';
import { createRunRecord } from '../state/run-repository.js';
import {
	requireWorkspaceState,
	updateWorkspaceState,
} from '../state/workspace-state-repository.js';
import type {
	ExecutiveCompileChangedPath,
	ExecutiveCompileDiagnostic,
	ExecutiveCompileInput,
	ExecutiveCompileMode,
	ExecutiveCompileOptions,
	ExecutiveCompilePlan,
	ExecutiveCompileReport,
	ExecutiveCompileResult,
	ExecutiveCompileStatus,
	ExecutiveCompileTarget,
	ExecutiveCompileTargetKind,
	ExecutiveCompileTargetStatus,
} from './executive-compile-workflow-types.js';
import { COMPILE_TARGET_TO_ADAPTER } from './executive-compile-workflow-types.js';
import { generateExecutiveExports } from './executive-export-generation.js';
import { loadExecutiveExportMappings } from './executive-export-mappings.js';
import type {
	ExecutiveExportAdapterKind,
	ExecutiveExportGenerationInput,
	ExecutiveExportGenerationResult,
} from './executive-export-model.js';
import { compileExecutivePlan } from './executive-plan-compiler.js';
import type {
	ExecutivePlanCompilationMode,
	ExecutivePlanJson,
} from './executive-plan-model.js';
import type {
	NormativeBaselineReadinessInput,
	NormativeBaselineReadinessResult,
	NormativeBaselineReadinessStatus,
} from './executive-readiness-types.js';
import { evaluateNormativeBaselineReadiness } from './normative-baseline-readiness.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_DOCUMENTATION_ROOT = 'logos/';
const DEFAULT_PLAN_ID_PREFIX = 'exec-compile';
const EXECUTIVE_MAPPINGS_DIR = 'profiles/standard/executive/mappings';

// ---------------------------------------------------------------------------
// Target kind labels
// ---------------------------------------------------------------------------

const TARGET_KIND_LABELS: Record<ExecutiveCompileTargetKind, string> = {
	agent_pack_file_export: 'Agent Pack File Export',
	executive_plan_json: 'Executive Plan JSON',
	github_issue_file_export: 'GitHub Issue File Export',
	html_export: 'HTML Export',
	linear_mapping: 'Linear Mapping',
	markdown_export: 'Markdown Export',
	notion_mapping: 'Notion Mapping',
};

const PLANNED_ADAPTER_TARGETS: ReadonlySet<ExecutiveCompileTargetKind> =
	new Set(['linear_mapping', 'notion_mapping']);

const FILE_EXPORT_TARGETS: ReadonlySet<ExecutiveCompileTargetKind> = new Set([
	'executive_plan_json',
	'markdown_export',
	'html_export',
	'github_issue_file_export',
	'agent_pack_file_export',
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createDiagnostic(
	code: string,
	severity: 'error' | 'warning' | 'info',
	message: string,
	opts?: Partial<{
		targetKind: ExecutiveCompileTargetKind;
		adapterKind: ExecutiveExportAdapterKind;
		outputPath: string;
		sourcePath: string;
		pointer: string;
		fieldPath: string;
		readinessBlockerMessage: string;
		recoveryHint: string;
	}>,
): ExecutiveCompileDiagnostic {
	const ro = opts as unknown as Record<string, unknown> | undefined;
	return {
		adapterKind: ro?.adapterKind as ExecutiveExportAdapterKind | undefined,
		code,
		fieldPath: ro?.fieldPath as string | undefined,
		message,
		outputPath: ro?.outputPath as string | undefined,
		pointer: ro?.pointer as string | undefined,
		readinessBlockerMessage: ro?.readinessBlockerMessage as string | undefined,
		recoveryHint: ro?.recoveryHint as string | undefined,
		severity,
		sourcePath: ro?.sourcePath as string | undefined,
		targetKind: ro?.targetKind as ExecutiveCompileTargetKind | undefined,
	};
}

function deterministicIdFactory(
	prefix: string,
	counter: { n: number },
): () => string {
	return () => `${prefix}-${Date.now()}-${(counter.n++).toString(36)}`;
}

function normalizeOptions(
	input: ExecutiveCompileInput,
): ExecutiveCompileOptions {
	const ri = input as unknown as Record<string, unknown>;
	const rawMode = ri.mode as string | undefined;
	const mode: ExecutiveCompileMode =
		rawMode === 'diagnostic_preview' || rawMode === 'diagnostic-preview'
			? 'diagnostic_preview'
			: 'strict';
	return {
		dryRun: ri.dryRun === true,
		mode,
		selectedTargets: (ri.selectedTargets as ExecutiveCompileTargetKind[]) ?? [
			'executive_plan_json',
		],
		writePolicy: (ri.writePolicy as 'skip_existing') ?? 'skip_existing',
	};
}

// ---------------------------------------------------------------------------
// Build readiness input
// ---------------------------------------------------------------------------

function buildReadinessInput(params: {
	state: Awaited<ReturnType<typeof requireWorkspaceState>>;
	contract: Awaited<ReturnType<typeof loadDocumentationContract>>;
	documentationRoot: string;
	projectRoot: string;
	timestamp: string;
}): NormativeBaselineReadinessInput {
	const { state, contract, documentationRoot, projectRoot, timestamp } = params;

	const documentEntries = contract.documents.map((doc) => ({
		canonicalOutputPath: doc.descriptor.outputs.canonical.path,
		descriptorStatus: doc.descriptor.status ?? 'draft',
		descriptorTitle: doc.descriptor.title,
		documentCanonicalId: doc.canonicalId as CanonicalDocumentId,
		documentOrder: 0,
		phaseId: doc.phaseId,
		phaseOrder: 0,
		required: true,
	}));

	const requiredDocumentIds = contract.documents.map(
		(d) => d.canonicalId as CanonicalDocumentId,
	);
	const requiredPhaseIds = contract.phases.map((p) => p.id);

	const phaseEntries = contract.phases.map((p, i) => ({
		order: i,
		phaseId: p.id,
		required: true,
		title: p.title,
	}));

	return {
		artifactRegistryEntries: (state.artifacts ?? []).map((a) => ({
			artifactId: a.artifactId,
			artifactType: a.artifactType,
			isCanonical: a.isCanonical ?? false,
			path: a.path,
			sourceDocumentIds: a.sourceDocumentIds ?? [],
		})),
		claims: [],
		consistencyExportReadiness: 'ready',
		consistencyFindings: [],
		documentationRoot,
		documentEntries,
		evaluatedAt: timestamp,
		executiveGenerationConfig: {
			allowDraftGeneration: true,
			allowExportWhenDraft: false,
			loaded: true,
			requiredStatus: 'baseline_ready',
			valid: true,
			version: '1.0.0',
		},
		phaseEntries,
		profileId: state.profile.profileId,
		profileVersion: state.profile.profileVersion ?? '1.0.0',
		projectRoot,
		registerCollections: undefined,
		requiredDocumentIds,
		requiredPhaseIds,
		sources: undefined,
	} as unknown as NormativeBaselineReadinessInput;
}

// ---------------------------------------------------------------------------
// Build compile plan
// ---------------------------------------------------------------------------

function buildCompilePlan(
	readiness: NormativeBaselineReadinessResult,
	options: ExecutiveCompileOptions,
): ExecutiveCompilePlan {
	const canCompile =
		options.mode === 'diagnostic_preview' ||
		readiness.status === 'ready' ||
		readiness.status === 'ready_with_warnings';

	const targets: ExecutiveCompileTarget[] = [];
	const outputPaths: string[] = [];
	const plannedAdapterContracts: string[] = [];
	const unsupportedTargets: string[] = [];

	for (const targetKind of options.selectedTargets) {
		if (PLANNED_ADAPTER_TARGETS.has(targetKind)) {
			plannedAdapterContracts.push(TARGET_KIND_LABELS[targetKind]);
			targets.push({
				adapterKind: COMPILE_TARGET_TO_ADAPTER[targetKind],
				diagnostics: [
					createDiagnostic(
						'exec_compile_planned_adapter',
						'info',
						`${TARGET_KIND_LABELS[targetKind]} is a planned adapter contract. No live sync/API creation is implemented.`,
					),
				],
				name: TARGET_KIND_LABELS[targetKind],
				status: 'planned_adapter_contract',
				targetKind,
			});
			continue;
		}

		if (FILE_EXPORT_TARGETS.has(targetKind)) {
			if (!canCompile) {
				targets.push({
					adapterKind: COMPILE_TARGET_TO_ADAPTER[targetKind],
					diagnostics: [],
					name: TARGET_KIND_LABELS[targetKind],
					status: 'blocked',
					targetKind,
				});
			} else {
				const outPath = targetKindOutputPath(
					targetKind,
					readiness.documentationRoot,
					readiness.activeProfileId,
				);
				if (outPath) outputPaths.push(outPath);
				targets.push({
					adapterKind: COMPILE_TARGET_TO_ADAPTER[targetKind],
					diagnostics: [],
					name: TARGET_KIND_LABELS[targetKind],
					outputPath: outPath,
					status: 'planned',
					targetKind,
				});
			}
		} else {
			unsupportedTargets.push(TARGET_KIND_LABELS[targetKind]);
			targets.push({
				diagnostics: [],
				name: TARGET_KIND_LABELS[targetKind],
				status: 'unsupported',
				targetKind,
			});
		}
	}

	const diagnostics: ExecutiveCompileDiagnostic[] = [];
	for (const blocker of readiness.blockers) {
		diagnostics.push(
			createDiagnostic('exec_readiness_blocker', 'error', blocker.message),
		);
	}
	for (const warning of readiness.warnings) {
		diagnostics.push(
			createDiagnostic('exec_readiness_warning', 'warning', warning.message),
		);
	}

	return {
		blockerCount: readiness.blockers.length,
		canCompile,
		canDiagnosticPreview: options.mode === 'diagnostic_preview',
		compilationGateStatus: readiness.executiveCompilationGateStatus,
		diagnostics,
		outputPaths,
		planFingerprint: `${readiness.status}-${readiness.requiredDocumentIds?.length ?? 0}`,
		planId: '',
		plannedAdapterContracts,
		readinessStatus: readiness.status,
		targets,
		unsupportedTargets,
		warningCount: readiness.warnings.length,
	};
}

function targetKindOutputPath(
	targetKind: ExecutiveCompileTargetKind,
	documentationRoot: string,
	profileId: string,
): string | undefined {
	switch (targetKind) {
		case 'executive_plan_json':
			return normalize(
				`${documentationRoot}/executive/executive-plan-${profileId}.json`,
			);
		default:
			return undefined;
	}
}

// ---------------------------------------------------------------------------
// Determine status
// ---------------------------------------------------------------------------

function determineStatus(
	isBlocked: boolean,
	hasWarnings: boolean,
	hasErrors: boolean,
	isDryRun: boolean,
): ExecutiveCompileStatus {
	if (hasErrors) return 'failed';
	if (isBlocked) return 'blocked';
	if (isDryRun) return 'dry_run';
	if (hasWarnings) return 'compiled_with_warnings';
	return 'compiled';
}

// ---------------------------------------------------------------------------
// Next actions
// ---------------------------------------------------------------------------

function buildNextActions(
	readinessStatus: NormativeBaselineReadinessStatus,
	isBlocked: boolean,
): string[] {
	const actions: string[] = [];
	if (isBlocked) {
		actions.push('Run /validate to check for validation findings');
		actions.push('Regenerate stale canonical docs with /generate --confirm');
		actions.push('Resolve blocking open questions');
		actions.push('Fix release-blocking validation findings');
		actions.push('Fix consistency/boundary violations');
		actions.push('Add missing provenance sources');
		actions.push('Repair executive profile mappings');
		actions.push('Rerun /executive compile --dry-run to recheck');
	} else if (readinessStatus === 'ready_with_warnings') {
		actions.push('Review compilation warnings before execution');
		actions.push('Consider resolving warnings for cleaner exports');
	} else {
		actions.push('Run /executive compile --confirm to execute');
		actions.push('Run /status to review workspace state');
	}
	return actions;
}

// ---------------------------------------------------------------------------
// Build report
// ---------------------------------------------------------------------------

function buildReport(
	plan: ExecutiveCompilePlan,
	compileStatus: ExecutiveCompileStatus,
	targets: readonly ExecutiveCompileTarget[],
	changedPaths: readonly ExecutiveCompileChangedPath[],
	exportResult: ExecutiveExportGenerationResult | null,
): ExecutiveCompileReport {
	const createdCount = targets.filter((t) => t.status === 'created').length;
	const updatedCount = targets.filter((t) => t.status === 'updated').length;
	const skippedCount = targets.filter((t) => t.status === 'skipped').length;
	const blockedCount = targets.filter(
		(t) => t.status === 'blocked' || t.status === 'planned_adapter_contract',
	).length;
	const failedCount = targets.filter((t) => t.status === 'failed').length;
	const unsupportedCount = targets.filter(
		(t) => t.status === 'unsupported',
	).length;

	const outputPaths = [
		...new Set(
			targets
				.filter((t) => typeof t.outputPath === 'string')
				.map((t) => t.outputPath as string)
				.concat(targets.flatMap((t) => t.outputPaths ?? []).filter(Boolean)),
		),
	];

	const targetResults = targets.map((t) => ({
		diagnostics: t.diagnostics,
		name: t.name,
		outputPaths: t.outputPaths ?? (t.outputPath ? [t.outputPath] : []),
		status: t.status,
		targetKind: t.targetKind,
	}));

	const blockers = plan.diagnostics
		.filter((d) => d.severity === 'error')
		.map((d) => d.message);
	const warnings = plan.diagnostics
		.filter((d) => d.severity === 'warning')
		.map((d) => d.message);

	const securitySummary = exportResult?.securitySummary ?? {
		checks: [],
		passed: true,
	};

	const summary =
		compileStatus === 'blocked'
			? 'Normative baseline is not ready for executive compilation.'
			: compileStatus === 'failed'
				? 'Executive compilation failed. Review diagnostics.'
				: compileStatus === 'dry_run'
					? `Dry-run: Planned ${createdCount} to create, ${updatedCount} to update, ${skippedCount} to skip, ${blockedCount} blocked, ${failedCount} failed.`
					: `Compiled with ${createdCount} created, ${updatedCount} updated, ${skippedCount} skipped, ${blockedCount} blocked, ${failedCount} failed.`;

	return {
		artifactRegistryUpdates: exportResult?.artifactRegistryEntriesCreated ?? 0,
		blockedCount,
		blockers,
		changedPaths,
		compileStatus,
		createdCount,
		failedCount,
		nextActions: buildNextActions(
			plan.readinessStatus,
			compileStatus === 'blocked',
		),
		noExternalApiCalls: true,
		noExternalRecordsCreated: true,
		outputPaths,
		outputsDerivedNonCanonical: true,
		plannedAdapterContracts: plan.plannedAdapterContracts,
		readinessStatus: plan.readinessStatus,
		securitySummary,
		selectedTargets: targets.map((t) => t.name),
		skippedCount,
		summary,
		targetResults,
		unsupportedCount,
		unsupportedTargets: plan.unsupportedTargets,
		updatedCount,
		warnings,
	};
}

// ---------------------------------------------------------------------------
// Adapter kind ↔ compile target kind
// ---------------------------------------------------------------------------

function adapterKindToTargetKind(
	adapterKind: ExecutiveExportAdapterKind,
): ExecutiveCompileTargetKind | undefined {
	for (const [targetKind, ak] of Object.entries(COMPILE_TARGET_TO_ADAPTER)) {
		if (ak === adapterKind) return targetKind as ExecutiveCompileTargetKind;
	}
	return undefined;
}

function adapterKindToArtifactType(
	adapterKind: ExecutiveExportAdapterKind,
): string {
	switch (adapterKind) {
		case 'markdown':
			return 'executive_markdown';
		case 'html':
			return 'executive_html';
		case 'github_issue_file':
			return 'data';
		case 'agent_pack_file':
			return 'agent_pack';
		default:
			return 'data';
	}
}

// ---------------------------------------------------------------------------
// Display lines
// ---------------------------------------------------------------------------

function buildDisplayLines(
	report: ExecutiveCompileReport,
	options: ExecutiveCompileOptions,
): string[] {
	const lines: string[] = [];

	if (report.compileStatus === 'blocked') {
		lines.push('Executive Compilation — BLOCKED');
		lines.push('');
		lines.push(`Readiness status: ${report.readinessStatus}`);
		lines.push(`Compile mode: ${options.mode}`);

		if (report.blockers.length > 0) {
			lines.push('');
			lines.push(`Blockers (${report.blockers.length}):`);
			for (const b of report.blockers.slice(0, 10)) {
				lines.push(`  • ${b}`);
			}
			if (report.blockers.length > 10) {
				lines.push(`  ... and ${report.blockers.length - 10} more`);
			}
		}

		if (report.warnings.length > 0) {
			lines.push('');
			lines.push(`Warnings (${report.warnings.length}):`);
			for (const w of report.warnings.slice(0, 10)) {
				lines.push(`  • ${w}`);
			}
		}
	} else if (report.compileStatus === 'failed') {
		lines.push('Executive Compilation — FAILED');
		lines.push('');
		lines.push('Compilation encountered errors. Review diagnostics.');
	} else if (report.compileStatus === 'dry_run') {
		lines.push('Executive Compilation — DRY-RUN');
		lines.push('');
		lines.push(`Readiness:     ${report.readinessStatus}`);
		lines.push(`Compile mode:  ${options.mode}`);
		lines.push(`Write policy:  ${options.writePolicy}`);
		lines.push('');
		lines.push('Planned targets:');
		for (const tr of report.targetResults) {
			const icon = statusIcon(tr.status);
			lines.push(`  ${icon} ${tr.name}: ${tr.status}`);
			for (const p of tr.outputPaths.slice(0, 3)) {
				lines.push(`      ${p}`);
			}
		}
		lines.push('');
		lines.push('(dry-run: no files were written)');
	} else {
		lines.push('Executive Compilation — COMPLETE');
		lines.push('');
		lines.push(`Readiness:     ${report.readinessStatus}`);
		lines.push(`Compile mode:  ${options.mode}`);
		lines.push('');
		lines.push('Results:');
		lines.push(`  Created:    ${report.createdCount}`);
		lines.push(`  Updated:    ${report.updatedCount}`);
		lines.push(`  Skipped:    ${report.skippedCount}`);
		lines.push(`  Blocked:    ${report.blockedCount}`);
		lines.push(`  Failed:     ${report.failedCount}`);
		lines.push(`  Unsupported: ${report.unsupportedCount}`);

		if (report.plannedAdapterContracts.length > 0) {
			lines.push('');
			lines.push('Planned adapter contracts (no live sync):');
			for (const p of report.plannedAdapterContracts) {
				lines.push(`  • ${p}`);
			}
		}

		if (report.outputPaths.length > 0) {
			lines.push('');
			lines.push('Output paths:');
			for (const p of report.outputPaths.slice(0, 10)) {
				lines.push(`  ${p}`);
			}
			if (report.outputPaths.length > 10) {
				lines.push(`  ... and ${report.outputPaths.length - 10} more`);
			}
		}
	}

	if (report.nextActions.length > 0) {
		lines.push('');
		lines.push('Next actions:');
		for (const action of report.nextActions.slice(0, 8)) {
			lines.push(`  • ${action}`);
		}
	}

	lines.push('');
	lines.push('No external APIs were called.');
	lines.push('No external records were created.');
	lines.push('Outputs are derived, non-canonical snapshots.');

	return lines;
}

function statusIcon(status: ExecutiveCompileTargetStatus): string {
	switch (status) {
		case 'created':
		case 'planned':
			return '[+]';
		case 'updated':
			return '[~]';
		case 'skipped':
		case 'planned_adapter_contract':
			return '[s]';
		case 'blocked':
			return '[!]';
		case 'failed':
			return '[x]';
		case 'unsupported':
			return '[-]';
		default:
			return '[?]';
	}
}

// ---------------------------------------------------------------------------
// Main compile workflow
// ---------------------------------------------------------------------------

export async function executiveCompileWorkflow(
	input: ExecutiveCompileInput,
): Promise<ExecutiveCompileResult> {
	const diagnostics: ExecutiveCompileDiagnostic[] = [];
	const options = normalizeOptions(input);
	const rawInput = input as unknown as Record<string, unknown>;
	const projectRoot = resolve(rawInput.projectRoot as string);
	const idCounter = { n: 0 };
	const idPrefix =
		(rawInput.deterministicIdPrefix as string) ?? DEFAULT_PLAN_ID_PREFIX;
	const runIdFactory = deterministicIdFactory(`${idPrefix}-run`, idCounter);
	const artifactIdFactory = deterministicIdFactory(
		`${idPrefix}-art`,
		idCounter,
	);
	const timestamp =
		(rawInput.deterministicTimestamp as string) ?? new Date().toISOString();

	const dryRun = options.dryRun;
	const changedPaths: ExecutiveCompileChangedPath[] = [];

	// ------------------------------------------------------------------
	// 1. Load workspace state
	// ------------------------------------------------------------------
	let state: Awaited<ReturnType<typeof requireWorkspaceState>>;
	try {
		state = await requireWorkspaceState({ projectRoot });
	} catch (error) {
		const msg = error instanceof Error ? error.message : String(error);
		diagnostics.push(
			createDiagnostic(
				'exec_compile_no_workspace',
				'error',
				`No initialized workspace found: ${msg}`,
			),
		);
		const plan = buildCompilePlan(
			{
				activeProfileId: 'unknown',
				blockers: [],
				documentationRoot: DEFAULT_DOCUMENTATION_ROOT,
				executiveCompilationGateStatus: 'blocked',
				requiredDocumentIds: [],
				status: 'blocked',
				warnings: [],
			} as unknown as NormativeBaselineReadinessResult,
			options,
		);
		return buildErrorResult(options, 'blocked', diagnostics, plan);
	}

	const profileId = state.profile.profileId;
	const documentationRoot =
		state.documentation.rootPath || DEFAULT_DOCUMENTATION_ROOT;

	// ------------------------------------------------------------------
	// 2. Load profile contract
	// ------------------------------------------------------------------
	let contract: Awaited<ReturnType<typeof loadDocumentationContract>>;
	try {
		contract = await loadDocumentationContract({
			profileId,
			repoRoot: projectRoot,
		});
	} catch (error) {
		const msg = error instanceof Error ? error.message : String(error);
		diagnostics.push(
			createDiagnostic(
				'exec_compile_profile_load_failed',
				'error',
				`Failed to load profile contract: ${msg}`,
			),
		);
		return buildErrorResult(options, 'failed', diagnostics, undefined);
	}

	let registry: Awaited<ReturnType<typeof loadProfileRegistry>> | undefined;
	try {
		registry = await loadProfileRegistry({ profileId, repoRoot: projectRoot });
	} catch {
		registry = undefined;
	}

	const _graph = buildDocumentDependencyGraph({
		contract,
		registry: (registry ?? { phases: [], profileId: 'unknown' }) as never,
	} as never);

	// Build readiness input
	const readinessInput = buildReadinessInput({
		contract,
		documentationRoot,
		projectRoot,
		state,
		timestamp,
	});

	// ------------------------------------------------------------------
	// 3. Evaluate readiness
	// ------------------------------------------------------------------
	let readiness: NormativeBaselineReadinessResult;
	try {
		readiness = evaluateNormativeBaselineReadiness(readinessInput);
	} catch (error) {
		const msg = error instanceof Error ? error.message : String(error);
		diagnostics.push(
			createDiagnostic(
				'exec_compile_readiness_failed',
				'error',
				`Readiness evaluation failed: ${msg}`,
			),
		);
		return buildErrorResult(options, 'failed', diagnostics);
	}

	// ------------------------------------------------------------------
	// 4. Build compile plan
	// ------------------------------------------------------------------
	const plan = buildCompilePlan(readiness, options);

	for (const blocker of readiness.blockers) {
		diagnostics.push(
			createDiagnostic('exec_readiness_blocker', 'error', blocker.message),
		);
	}
	for (const warning of readiness.warnings) {
		diagnostics.push(
			createDiagnostic('exec_readiness_warning', 'warning', warning.message),
		);
	}

	// ------------------------------------------------------------------
	// 5. Check if blocked (strict mode)
	// ------------------------------------------------------------------
	const isBlocked =
		options.mode === 'strict' &&
		readiness.status !== 'ready' &&
		readiness.status !== 'ready_with_warnings';

	if (isBlocked) {
		const report = buildReport(plan, 'blocked', plan.targets, [], null);
		return {
			diagnostics,
			documentationRoot,
			dryRun,
			mode: options.mode,
			profileId,
			readyForDisplay: buildDisplayLines(report, options),
			report,
			status: 'blocked',
		};
	}

	// ------------------------------------------------------------------
	// 6. Compile Executive Plan JSON
	// ------------------------------------------------------------------
	const compileResult = compileExecutivePlan(
		{
			clock: () => timestamp,
			compilationMode: options.mode as ExecutivePlanCompilationMode,
			readinessResult: readiness,
		} as never,
		undefined as never,
	);

	if (compileResult.status === 'failed') {
		for (const diag of compileResult.diagnostics) {
			const sev: 'error' | 'warning' | 'info' =
				diag.severity === 'fatal' || diag.severity === 'error'
					? 'error'
					: diag.severity === 'warning'
						? 'warning'
						: 'info';
			diagnostics.push(createDiagnostic(diag.code, sev, diag.message));
		}
		return buildErrorResult(options, 'failed', diagnostics);
	}

	const planJson: ExecutivePlanJson | null = compileResult.plan;

	if (!planJson) {
		if (options.mode === 'diagnostic_preview') {
			const report = buildReport(plan, 'blocked', plan.targets, [], null);
			return {
				diagnostics,
				documentationRoot,
				dryRun,
				mode: options.mode,
				profileId,
				readyForDisplay: buildDisplayLines(report, options),
				report,
				status: 'blocked',
			};
		}
		diagnostics.push(
			createDiagnostic(
				'exec_compile_no_plan',
				'error',
				'No Executive Plan JSON was compiled.',
			),
		);
		return buildErrorResult(options, 'failed', diagnostics);
	}

	const planId =
		((planJson as unknown as Record<string, unknown>).planId as string) ??
		`${idPrefix}-plan`;
	const planFingerprint = `${readiness.status}-${((readiness as unknown as Record<string, unknown>).requiredDocumentIds as unknown[] | undefined)?.length ?? 0}`;

	// ------------------------------------------------------------------
	// 7. Write JSON artifact
	// ------------------------------------------------------------------
	const jsonTargetKind: ExecutiveCompileTargetKind = 'executive_plan_json';
	const jsonOutputPath = targetKindOutputPath(
		jsonTargetKind,
		documentationRoot,
		profileId,
	);
	let jsonArtifactId: string | undefined;

	if (options.selectedTargets.includes(jsonTargetKind) && jsonOutputPath) {
		if (!dryRun) {
			const fullPath = resolve(projectRoot, jsonOutputPath);
			try {
				const dir = dirname(fullPath);
				if (!existsSync(dir)) {
					mkdirSync(dir, { recursive: true });
				}
				writeFileSync(fullPath, JSON.stringify(planJson, null, '\t'), 'utf-8');

				jsonArtifactId = artifactIdFactory();
				changedPaths.push({
					path: jsonOutputPath,
					role: 'created',
					targetKind: jsonTargetKind,
				});
				mutTarget(plan, jsonTargetKind, 'created', jsonOutputPath);
			} catch (error) {
				const msg = error instanceof Error ? error.message : String(error);
				diagnostics.push(
					createDiagnostic(
						'exec_compile_json_write_failed',
						'error',
						`Failed to write Executive Plan JSON: ${msg}`,
					),
				);
				mutTarget(plan, jsonTargetKind, 'failed', jsonOutputPath);
			}
		} else {
			mutTarget(plan, jsonTargetKind, 'planned', jsonOutputPath);
		}
	}

	// ------------------------------------------------------------------
	// 8. Generate exports
	// ------------------------------------------------------------------
	let exportResult: ExecutiveExportGenerationResult | null = null;
	const exportAdapterKinds = options.selectedTargets
		.map((t) => COMPILE_TARGET_TO_ADAPTER[t])
		.filter((k): k is ExecutiveExportAdapterKind => !!k);

	if (exportAdapterKinds.length > 0) {
		try {
			const mappingsDir = resolve(projectRoot, EXECUTIVE_MAPPINGS_DIR);
			const mappingsLoadResult = loadExecutiveExportMappings(mappingsDir);
			const mappings = mappingsLoadResult.mappings;

			const filteredMappings = mappings.filter((m) =>
				exportAdapterKinds.includes(m.adapterKind),
			);

			const genInput: ExecutiveExportGenerationInput = {
				clock: () => timestamp,
				documentationRoot,
				mappings: filteredMappings,
				plan: planJson,
				planFingerprint,
				planId,
				profileId,
				profileVersion: state.profile.profileVersion,
				readinessStatus: readiness.status,
				selectedAdapterKinds: exportAdapterKinds,
			};

			exportResult = generateExecutiveExports(genInput, {
				dryRun,
				strictMode: options.mode === 'strict',
				writePolicy: options.writePolicy as never,
			} as never);

			for (const item of exportResult.items) {
				const targetKind = adapterKindToTargetKind(item.adapterKind);
				if (!targetKind) continue;

				let targetStatus: ExecutiveCompileTargetStatus;
				switch (item.status) {
					case 'created':
						targetStatus = dryRun ? 'planned' : 'created';
						break;
					case 'updated':
						targetStatus = 'updated';
						break;
					case 'skipped':
						targetStatus = 'skipped';
						break;
					case 'blocked':
						targetStatus = 'blocked';
						break;
					case 'requires_review':
						targetStatus = 'planned_adapter_contract';
						break;
					default:
						targetStatus = 'failed';
				}

				mutTarget(plan, targetKind, targetStatus, undefined, item.outputPaths);

				for (const cp of exportResult.changedPaths) {
					const roleMap: Record<
						string,
						'created' | 'updated' | 'skipped' | 'blocked' | 'failed'
					> = {
						blocked: 'blocked',
						created: 'created',
						failed: 'failed',
						skipped: 'skipped',
						updated: 'updated',
					};
					changedPaths.push({
						checksum: cp.checksum,
						path: cp.path,
						role: roleMap[cp.role] ?? 'created',
						targetKind,
					});
				}
			}

			for (const diag of exportResult.diagnostics) {
				const sev: 'error' | 'warning' | 'info' =
					diag.severity === 'fatal' || diag.severity === 'error'
						? 'error'
						: diag.severity === 'warning'
							? 'warning'
							: 'info';
				diagnostics.push(createDiagnostic(diag.code, sev, diag.message));
			}
		} catch (error) {
			const msg = error instanceof Error ? error.message : String(error);
			diagnostics.push(
				createDiagnostic(
					'exec_compile_export_failed',
					'error',
					`Export generation failed: ${msg}`,
				),
			);
		}
	}

	// ------------------------------------------------------------------
	// 9. Update artifact registry and run metadata (non-dry-run only)
	// ------------------------------------------------------------------
	let runId: string | undefined;

	if (!dryRun) {
		runId = runIdFactory();

		const artifactRegistryEntries: Array<{
			artifactId: string;
			artifactType: string;
			path: string;
			isCanonical: false;
		}> = [];

		if (jsonArtifactId) {
			const capturedJsonPath = jsonOutputPath as string;
			artifactRegistryEntries.push({
				artifactId: jsonArtifactId,
				artifactType: 'executive_json',
				isCanonical: false,
				path: capturedJsonPath,
			});
		}

		if (exportResult) {
			for (const item of exportResult.items) {
				if (item.status === 'created' || item.status === 'updated') {
					for (let i = 0; i < item.artifactIds.length; i++) {
						const artId = item.artifactIds[i] ?? artifactIdFactory();
						const artPath =
							item.outputPaths[i] ??
							`${documentationRoot}/executive/${item.targetId}`;
						artifactRegistryEntries.push({
							artifactId: artId,
							artifactType: adapterKindToArtifactType(item.adapterKind),
							isCanonical: false,
							path: artPath,
						});
					}
				}
			}
		}

		try {
			const updateResult = await updateWorkspaceState({
				dryRun: false,
				projectRoot,
				updater: (
					currentState: import('../state/workspace-state.schema.js').WorkspaceState,
				) => {
					let s = currentState;
					for (const entry of artifactRegistryEntries) {
						const regResult = registerArtifact({
							idFactory: () => entry.artifactId,
							input: {
								artifactType: entry.artifactType as never,
								generatedAt: timestamp,
								isCanonical: false,
								metadata: {
									derivedSnapshot: true,
									externalApiExecution: false,
									nonCanonical: true,
								},
								path: entry.path,
								runId,
								status: 'generated',
							} as never,
							state: s,
						});
						s = regResult.state;
					}

					const capturedRunId = runId as string;

					const runRecord = createRunRecord({
						idFactory: () => capturedRunId,
						input: {
							changedPaths: changedPaths.map((p) => p.path),
							command: '/executive compile',
							completedAt: timestamp,
							dryRun: false,
							relatedArtifactIds: artifactRegistryEntries.map(
								(e) => e.artifactId,
							),
							runType: 'executive',
							startedAt: timestamp,
							status: 'completed',
							warnings: diagnostics
								.filter((d) => d.severity === 'warning')
								.map((d) => d.message),
						},
						state: s,
					});
					s = runRecord.state;
					return s;
				},
			} as never);

			if (!updateResult.success) {
				diagnostics.push(
					createDiagnostic(
						'exec_compile_state_update_failed',
						'error',
						'Failed to update workspace state with artifact records.',
					),
				);
			}
		} catch (error) {
			const msg = error instanceof Error ? error.message : String(error);
			diagnostics.push(
				createDiagnostic(
					'exec_compile_state_update_error',
					'error',
					`Workspace state update error: ${msg}`,
				),
			);
		}
	}

	// ------------------------------------------------------------------
	// 10. Determine final status and return
	// ------------------------------------------------------------------
	const hasWarnings =
		diagnostics.some((d) => d.severity === 'warning') ||
		readiness.status === 'ready_with_warnings';
	const hasErrors = diagnostics.some((d) => d.severity === 'error');
	const finalStatus = determineStatus(false, hasWarnings, hasErrors, dryRun);

	const report = buildReport(
		plan,
		finalStatus,
		plan.targets,
		changedPaths,
		exportResult,
	);

	return {
		diagnostics,
		documentationRoot,
		dryRun,
		mode: options.mode,
		profileId,
		readyForDisplay: buildDisplayLines(report, options),
		report,
		runId,
		status: finalStatus,
	};
}

// ---------------------------------------------------------------------------
// Build error result
// ---------------------------------------------------------------------------

function buildErrorResult(
	options: ExecutiveCompileOptions,
	status: ExecutiveCompileStatus,
	diagnostics: readonly ExecutiveCompileDiagnostic[],
	plan?: ExecutiveCompilePlan | undefined,
): ExecutiveCompileResult {
	const targets = plan?.targets ?? [];
	const report: ExecutiveCompileReport = {
		artifactRegistryUpdates: 0,
		blockedCount: targets.filter((t) => t.status === 'blocked').length,
		blockers: diagnostics
			.filter((d) => d.severity === 'error')
			.map((d) => d.message),
		changedPaths: [],
		compileStatus: status,
		createdCount: 0,
		failedCount: 0,
		nextActions: buildNextActions(
			plan?.readinessStatus ?? 'blocked',
			status === 'blocked',
		),
		noExternalApiCalls: true,
		noExternalRecordsCreated: true,
		outputPaths: [],
		outputsDerivedNonCanonical: true,
		plannedAdapterContracts: plan?.plannedAdapterContracts ?? [],
		readinessStatus: plan?.readinessStatus ?? 'unknown',
		securitySummary: { checks: [], passed: true },
		selectedTargets: targets.map((t) => t.name),
		skippedCount: 0,
		summary: `Executive compilation ${status}.`,
		targetResults: targets.map((t) => ({
			diagnostics: t.diagnostics,
			name: t.name,
			outputPaths: t.outputPaths ?? (t.outputPath ? [t.outputPath] : []),
			status: t.status,
			targetKind: t.targetKind,
		})),
		unsupportedCount: targets.filter((t) => t.status === 'unsupported').length,
		unsupportedTargets: plan?.unsupportedTargets ?? [],
		updatedCount: 0,
		warnings: diagnostics
			.filter((d) => d.severity === 'warning')
			.map((d) => d.message),
	};

	return {
		diagnostics,
		documentationRoot: DEFAULT_DOCUMENTATION_ROOT,
		dryRun: options.dryRun,
		mode: options.mode,
		profileId: 'unknown',
		readyForDisplay: buildDisplayLines(report, options),
		report,
		status,
	};
}

// ---------------------------------------------------------------------------
// Mutable target update
// ---------------------------------------------------------------------------

function mutTarget(
	plan: ExecutiveCompilePlan,
	targetKind: ExecutiveCompileTargetKind,
	status: ExecutiveCompileTargetStatus,
	outputPath?: string,
	outputPaths?: readonly string[],
): void {
	const target = plan.targets.find((t) => t.targetKind === targetKind);
	if (target) {
		(target as unknown as Record<string, unknown>).status = status;
		if (outputPath !== undefined) {
			(target as unknown as Record<string, unknown>).outputPath = outputPath;
		}
		if (outputPaths !== undefined) {
			(target as unknown as Record<string, unknown>).outputPaths = outputPaths;
		}
	}
}
