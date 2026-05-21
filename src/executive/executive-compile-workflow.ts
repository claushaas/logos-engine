/** Step 11.4 — Executive Compile Workflow Service */

import { existsSync, readFileSync } from 'node:fs';
import { normalize, resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { buildDocumentDependencyGraph } from '../dependency-graph/index.js';
import { writeFileAtomic, writeJsonAtomic } from '../fs/safe-filesystem.js';
import {
	type CanonicalDocumentId,
	loadDocumentationContract,
} from '../profiles/documentation-contract.js';
import { loadProfileRegistry } from '../profiles/profile-registry.js';
import {
	type ActiveProfileRuntimePaths,
	resolveActiveProfileRuntimePaths,
} from '../profiles/profile-runtime-paths.js';
import { detectStaleness } from '../staleness/index.js';
import { registerArtifact } from '../state/artifact-registry.js';
import { createRunRecord } from '../state/run-repository.js';
import {
	requireWorkspaceState,
	updateWorkspaceState,
} from '../state/workspace-state-repository.js';
import { executiveAgentPackExportAdapter } from './executive-agent-pack-export.js';
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
	ExecutiveExportInput,
	ExecutiveExportResult,
} from './executive-export-model.js';
import { executiveGitHubIssuesExportAdapter } from './executive-github-issues-export.js';
import { executiveHtmlExportAdapter } from './executive-html-export.js';
import { executiveMarkdownExportAdapter } from './executive-markdown-export.js';
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
	return () => `${prefix}-${(counter.n++).toString(36).padStart(4, '0')}`;
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

function timestampForId(timestamp: string): string {
	return timestamp.replace(/[^0-9A-Za-z]+/g, '-').replace(/^-|-$/g, '');
}

function normalizeCoverageKey(value: string): string {
	return value
		.replace(/^[0-9]+[-_]/, '')
		.replace(/[^a-zA-Z0-9]/g, '')
		.toLowerCase();
}

function mapWritePolicy(
	policy: ExecutiveCompileOptions['writePolicy'],
): 'skip_if_exists' | 'fail_if_exists' | 'backup_and_overwrite' | 'overwrite' {
	switch (policy) {
		case 'backup_and_write':
			return 'backup_and_overwrite';
		case 'explicit_overwrite':
			return 'overwrite';
		case 'fail_on_collision':
			return 'fail_if_exists';
		default:
			return 'skip_if_exists';
	}
}

function prefixDocumentationRoot(
	documentationRoot: string,
	relativePath: string,
): string {
	return normalize(
		`${documentationRoot.replace(/\\/g, '/').replace(/\/$/, '')}/${relativePath}`,
	);
}

function loadExecutiveGenerationConfig(
	configPath: string,
	mappingsDir: string,
): {
	allowDraftGeneration: boolean;
	allowExportWhenDraft: boolean;
	diagnostics: readonly { code: string; message: string }[];
	exportTargets: readonly string[];
	loaded: boolean;
	minimumCoverage:
		| {
				readonly [phaseKey: string]:
					| {
							readonly required: boolean;
							readonly requiredDocuments: string[];
					  }
					| undefined;
		  }
		| undefined;
	missingMappings: readonly string[];
	plannedMappings: readonly string[];
	requiredStatus: string | undefined;
	valid: boolean;
	version: string | undefined;
} {
	const diagnostics: { code: string; message: string }[] = [];
	try {
		const raw = readFileSync(configPath, 'utf-8');
		const parsed = parseYaml(raw) as Record<string, unknown>;
		const readinessGate =
			(parsed.readinessGate as Record<string, unknown> | undefined) ?? {};
		const exportsConfig =
			(parsed.exports as Record<string, unknown> | undefined) ?? {};
		const targets =
			(exportsConfig.targets as Record<string, unknown> | undefined) ?? {};
		const targetIds = Object.keys(targets).map((id) =>
			id === 'githubIssues'
				? 'github-issues'
				: id === 'agentPack'
					? 'agent-pack'
					: id,
		);
		const expectedMappingFiles: Record<string, string> = {
			'agent-pack': 'agent-pack.mapping.yml',
			'github-issues': 'github-issues.mapping.yml',
			html: 'html.mapping.yml',
			linear: 'linear.mapping.yml',
			markdown: 'markdown.mapping.yml',
			notion: 'notion.mapping.yml',
		};
		const missingMappings = Object.entries(expectedMappingFiles)
			.filter(([id, filename]) => {
				if (!targetIds.includes(id)) return false;
				return !existsSync(resolve(mappingsDir, filename));
			})
			.map(([id]) => id);
		const plannedMappings = targetIds.filter(
			(id) => id === 'linear' || id === 'notion',
		);

		return {
			allowDraftGeneration: readinessGate.allowDraftGeneration === true,
			allowExportWhenDraft: readinessGate.allowExportWhenDraft === true,
			diagnostics,
			exportTargets: targetIds,
			loaded: true,
			minimumCoverage:
				(readinessGate.minimumCoverage as
					| {
							readonly [phaseKey: string]:
								| {
										readonly required: boolean;
										readonly requiredDocuments: string[];
								  }
								| undefined;
					  }
					| undefined) ?? undefined,
			missingMappings,
			plannedMappings,
			requiredStatus: readinessGate.requiredStatus as string | undefined,
			valid: missingMappings.length === 0,
			version: parsed.version as string | undefined,
		};
	} catch (error) {
		diagnostics.push({
			code: 'executive_config_load_failed',
			message: error instanceof Error ? error.message : String(error),
		});
		return {
			allowDraftGeneration: false,
			allowExportWhenDraft: false,
			diagnostics,
			exportTargets: [],
			loaded: false,
			minimumCoverage: undefined,
			missingMappings: [],
			plannedMappings: [],
			requiredStatus: undefined,
			valid: false,
			version: undefined,
		};
	}
}

// ---------------------------------------------------------------------------
// Build readiness input
// ---------------------------------------------------------------------------

function buildReadinessInput(params: {
	state: Awaited<ReturnType<typeof requireWorkspaceState>>;
	contract: Awaited<ReturnType<typeof loadDocumentationContract>>;
	documentationRoot: string;
	projectRoot: string;
	stalenessResult?: Awaited<ReturnType<typeof detectStaleness>> | undefined;
	timestamp: string;
	runtimePaths: ActiveProfileRuntimePaths;
}): NormativeBaselineReadinessInput {
	const {
		state,
		contract,
		documentationRoot,
		projectRoot,
		stalenessResult,
		timestamp,
		runtimePaths,
	} = params;
	const executiveGenerationConfig = loadExecutiveGenerationConfig(
		runtimePaths.executiveGenerationConfigPath,
		runtimePaths.executiveMappingsDirectory,
	);

	const documentEntries = contract.documents.map((doc) => ({
		canonicalOutputPath: doc.descriptor.outputs.canonical.path,
		descriptorStatus: doc.descriptor.status ?? 'draft',
		descriptorTitle: doc.descriptor.title,
		documentCanonicalId: doc.canonicalId as CanonicalDocumentId,
		documentOrder: doc.documentOrder,
		phaseId: doc.phaseId,
		phaseOrder: doc.phaseOrder,
		required: true,
	}));

	const phaseByCoverageKey = new Map(
		contract.phases.map((phase) => [normalizeCoverageKey(phase.id), phase.id]),
	);
	const docByPhaseAndCoverageKey = new Map<string, CanonicalDocumentId>();
	for (const doc of contract.documents) {
		docByPhaseAndCoverageKey.set(
			`${doc.phaseId}:${normalizeCoverageKey(doc.canonicalId)}`,
			doc.canonicalId as CanonicalDocumentId,
		);
	}

	const requiredDocumentIds: CanonicalDocumentId[] = [];
	const requiredPhaseIds: string[] = [];
	const minimumCoverage = executiveGenerationConfig.minimumCoverage;
	if (minimumCoverage) {
		for (const [phaseKey, coverage] of Object.entries(minimumCoverage)) {
			if (!coverage?.required) continue;
			const phaseId = phaseByCoverageKey.get(normalizeCoverageKey(phaseKey));
			if (!phaseId) continue;
			requiredPhaseIds.push(phaseId);
			for (const requiredDoc of coverage.requiredDocuments) {
				const docId = docByPhaseAndCoverageKey.get(
					`${phaseId}:${normalizeCoverageKey(requiredDoc)}`,
				);
				if (docId) requiredDocumentIds.push(docId);
			}
		}
	}

	if (requiredDocumentIds.length === 0) {
		requiredDocumentIds.push(
			...contract.documents.map((d) => d.canonicalId as CanonicalDocumentId),
		);
		requiredPhaseIds.push(...contract.phases.map((p) => p.id));
	}

	const phaseEntries = contract.phases.map((p, i) => ({
		order: i,
		phaseId: p.id,
		required: requiredPhaseIds.includes(p.id),
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
		executiveConfigSourcePath:
			runtimePaths.safeDisplay.executiveGenerationConfigPath,
		executiveGenerationConfig,
		phaseEntries,
		profileId: state.profile.profileId,
		profileVersion: state.profile.profileVersion ?? '1.0.0',
		projectRoot,
		registerCollections: undefined,
		requiredDocumentIds,
		requiredPhaseIds: [...new Set(requiredPhaseIds)],
		sources: undefined,
		stalenessSummary: stalenessResult?.summary,
		stalenessTargets: stalenessResult?.targets,
	} as unknown as NormativeBaselineReadinessInput;
}

async function runWorkflowStalenessDetection(params: {
	contract: Awaited<ReturnType<typeof loadDocumentationContract>>;
	graphResult: ReturnType<typeof buildDocumentDependencyGraph>;
	projectRoot: string;
	state: Awaited<ReturnType<typeof requireWorkspaceState>>;
}): Promise<Awaited<ReturnType<typeof detectStaleness>> | undefined> {
	const { contract, graphResult, projectRoot, state } = params;
	try {
		return await detectStaleness(
			{
				artifactRegistryEntries: state.artifacts.map((a) => ({
					artifactId: a.artifactId,
					artifactType: a.artifactType,
					checksum: a.checksum,
					generatedAt: a.generatedAt,
					isCanonical: a.isCanonical,
					metadata: a.metadata,
					path: a.path,
					runId: a.runId,
					sourceDocumentIds: a.sourceDocumentIds,
					status: a.status,
				})),
				assumptions: state.assumptions.map((a) => ({
					affectedDocumentIds: a.affectedDocumentIds,
					body: a.body,
					createdAt: a.createdAt,
					id: a.id,
					status: a.status,
					title: a.title,
					updatedAt: a.updatedAt,
				})),
				decisions: state.decisions.map((d) => ({
					affectedDocumentIds: d.affectedDocumentIds,
					body: d.body,
					createdAt: d.createdAt,
					id: d.id,
					status: d.status,
					title: d.title,
					updatedAt: d.updatedAt,
				})),
				dependencyGraph: {
					edges: graphResult.graph.edges,
					nodeMap: graphResult.graph.nodeMap,
					nodes: graphResult.graph.nodes,
					upstreamEdges: graphResult.graph.upstreamEdges,
				},
				documentationRoot: state.documentation.rootPath,
				generatedMetadataOverrides: new Map(),
				generationRuns: state.runs
					.filter(
						(r) => r.runType === 'generation' || r.runType === 'executive',
					)
					.map((r) => ({
						completedAt: r.completedAt,
						relatedArtifactIds: r.relatedArtifactIds,
						runId: r.runId,
						startedAt: r.startedAt,
						status: r.status,
					})),
				loadedDescriptorData: new Map(
					contract.documents.map((doc) => [
						doc.canonicalId,
						{
							canonicalOutput: doc.descriptor.outputs.canonical.path,
							inputs: (doc.descriptor.inputs ?? []).map((i) => ({
								id: i.id,
								required: i.required,
								type: i.type,
							})),
							outputs: doc.descriptor.outputs
								? [
										{
											format: doc.descriptor.outputs.canonical.format,
											kind: 'canonical',
											path: doc.descriptor.outputs.canonical.path,
										},
									]
								: [],
							phaseId: doc.phaseId,
							status: doc.descriptor.status,
							title: doc.descriptor.title,
						},
					]),
				),
				openQuestions: state.openQuestions.map((q) => ({
					affectedDocumentIds: q.affectedDocumentIds,
					body: q.body,
					createdAt: q.createdAt,
					id: q.id,
					question: q.question,
					status: q.status,
					updatedAt: q.updatedAt,
				})),
				phaseDescriptors: contract.phases.map((p) => ({
					id: p.id,
					sourcePath: p.sourcePath,
					title: p.title,
				})),
				profileId: state.profile.profileId,
				profileRegistryFingerprint: '',
				profileRoot: contract.profileRoot,
				profileVersion: state.profile.profileVersion,
				risks: state.risks.map((r) => ({
					affectedDocumentIds: r.affectedDocumentIds,
					body: r.body,
					createdAt: r.createdAt,
					id: r.id,
					severity: r.severity,
					status: r.status,
					title: r.title,
					updatedAt: r.updatedAt,
				})),
			},
			{
				outputFileExists: async (outputPath: string) =>
					existsSync(resolve(projectRoot, outputPath)),
			},
		);
	} catch {
		return undefined;
	}
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

function renderExecutiveExport(
	input: ExecutiveExportInput,
): ExecutiveExportResult | undefined {
	switch (input.mapping.adapterKind) {
		case 'agent_pack_file':
			return executiveAgentPackExportAdapter.render(input);
		case 'github_issue_file':
			return executiveGitHubIssuesExportAdapter.render(input);
		case 'html':
			return executiveHtmlExportAdapter.render(input);
		case 'markdown':
			return executiveMarkdownExportAdapter.render(input);
		default:
			return undefined;
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
	const timestamp =
		(rawInput.deterministicTimestamp as string) ?? new Date().toISOString();
	const idPrefix =
		(rawInput.deterministicIdPrefix as string) ??
		`${DEFAULT_PLAN_ID_PREFIX}-${timestampForId(timestamp)}`;
	const runIdFactory = deterministicIdFactory(`${idPrefix}-run`, idCounter);
	const artifactIdFactory = deterministicIdFactory(
		`${idPrefix}-art`,
		idCounter,
	);

	const dryRun = options.dryRun || options.mode === 'diagnostic_preview';
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

	// Resolve active profile runtime paths (includes Executive contract paths)
	const runtimePaths = resolveActiveProfileRuntimePaths({
		profileLock: state.profile,
		projectRoot,
		requireExecutive: true,
	});

	// Surface active profile Executive contract diagnostics
	for (const diag of runtimePaths.executiveContractDiagnostics) {
		const sev: 'error' | 'warning' | 'info' =
			diag.severity === 'error'
				? 'error'
				: diag.severity === 'warning'
					? 'warning'
					: 'info';
		const diagOpts: Partial<{
			recoveryHint: string;
			sourcePath: string;
		}> = {};
		if (diag.recoveryHint) diagOpts.recoveryHint = diag.recoveryHint;
		if (diag.sourcePath) diagOpts.sourcePath = diag.sourcePath;
		diagnostics.push(createDiagnostic(diag.code, sev, diag.message, diagOpts));
	}

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

	const graphResult = buildDocumentDependencyGraph({
		contract,
		registry: (registry ?? { phases: [], profileId: 'unknown' }) as never,
	} as never);
	const stalenessResult = await runWorkflowStalenessDetection({
		contract,
		graphResult,
		projectRoot,
		state,
	});

	// Build readiness input
	const readinessInput = buildReadinessInput({
		contract,
		documentationRoot,
		projectRoot,
		runtimePaths,
		stalenessResult,
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
		},
		{
			executiveSchemaPath: runtimePaths.executiveSchemaPath,
			profileSource: runtimePaths.source,
		},
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
				const writeResult = await writeJsonAtomic(fullPath, planJson, {
					_testTimestamp: timestampForId(timestamp),
					allowedBaseDir: resolve(projectRoot, documentationRoot),
					dryRun: false,
					enableSecretRedaction: true,
					indent: 2,
					policy: mapWritePolicy(options.writePolicy),
				});
				if (!writeResult.success) {
					for (const diag of writeResult.diagnostics) {
						diagnostics.push(
							createDiagnostic(
								`exec_compile_json_${diag.code}`,
								'error',
								diag.message,
								{
									outputPath: jsonOutputPath,
									...(diag.recoveryHint
										? { recoveryHint: diag.recoveryHint }
										: {}),
									targetKind: jsonTargetKind,
								},
							),
						);
					}
					mutTarget(plan, jsonTargetKind, 'failed', jsonOutputPath);
				} else {
					const fileChange = writeResult.changedPaths.find(
						(change) =>
							change.role === 'file_created' ||
							change.role === 'file_updated' ||
							change.role === 'skipped',
					);
					const role =
						fileChange?.role === 'file_updated'
							? 'updated'
							: fileChange?.role === 'skipped'
								? 'skipped'
								: 'created';
					if (role !== 'skipped') {
						jsonArtifactId = artifactIdFactory();
					}
					changedPaths.push({
						path: jsonOutputPath,
						role,
						targetKind: jsonTargetKind,
					});
					mutTarget(plan, jsonTargetKind, role, jsonOutputPath);
				}
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
			const mappingsDir = runtimePaths.executiveMappingsDirectory;
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
				injectArtifactIds: Array.from({ length: 256 }, () =>
					artifactIdFactory(),
				),
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

				if (dryRun) {
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

			if (!dryRun) {
				for (const mapping of filteredMappings) {
					const targetKind = adapterKindToTargetKind(mapping.adapterKind);
					if (!targetKind) continue;
					const target = plan.targets.find((t) => t.targetKind === targetKind);
					if (!target || target.status !== 'created') continue;
					const rendered = renderExecutiveExport({
						clock: () => timestamp,
						documentationRoot,
						mapping,
						plan: planJson,
						planFingerprint,
						planId,
						profileId,
						profileVersion: state.profile.profileVersion,
						readinessStatus: readiness.status,
					});
					if (!rendered) continue;
					let targetFailed = false;
					for (const file of rendered.renderedFiles) {
						const targetPath = resolve(
							projectRoot,
							documentationRoot,
							file.relativePath,
						);
						const writeResult = await writeFileAtomic(
							targetPath,
							file.content,
							{
								_testTimestamp: timestampForId(timestamp),
								allowedBaseDir: resolve(projectRoot, documentationRoot),
								dryRun: false,
								enableSecretRedaction: true,
								policy: mapWritePolicy(options.writePolicy),
							},
						);
						if (!writeResult.success) {
							targetFailed = true;
							for (const diag of writeResult.diagnostics) {
								diagnostics.push(
									createDiagnostic(
										`exec_compile_export_${diag.code}`,
										'error',
										diag.message,
										{
											adapterKind: mapping.adapterKind,
											outputPath: prefixDocumentationRoot(
												documentationRoot,
												file.relativePath,
											),
											...(diag.recoveryHint
												? { recoveryHint: diag.recoveryHint }
												: {}),
											targetKind,
										},
									),
								);
							}
							continue;
						}
						const fileChange = writeResult.changedPaths.find(
							(change) =>
								change.role === 'file_created' ||
								change.role === 'file_updated' ||
								change.role === 'skipped',
						);
						const role =
							fileChange?.role === 'file_updated'
								? 'updated'
								: fileChange?.role === 'skipped'
									? 'skipped'
									: 'created';
						changedPaths.push({
							checksum: file.checksum,
							path: prefixDocumentationRoot(
								documentationRoot,
								file.relativePath,
							),
							role,
							targetKind,
						});
					}
					if (targetFailed) {
						mutTarget(plan, targetKind, 'failed', undefined, []);
					}
				}
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
				const targetKind = adapterKindToTargetKind(item.adapterKind);
				const targetStatus = plan.targets.find(
					(t) => t.targetKind === targetKind,
				)?.status;
				if (item.status === 'created' || item.status === 'updated') {
					if (targetStatus !== 'created' && targetStatus !== 'updated') {
						continue;
					}
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
