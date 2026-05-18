/** Step 9.3 — HTML Review View Generation: orchestrator for safe, local, static HTML review artifacts */

import { createHash } from 'node:crypto';
import { isAbsolute, relative, resolve } from 'node:path';
import type { SafeWritePolicy } from '../fs/safe-filesystem.js';
import { writeFileAtomic } from '../fs/safe-filesystem.js';
import type { OutputDeclaration } from '../profiles/contract-graph.js';
import { buildContractGraph } from '../profiles/contract-graph.js';
import { loadDocumentationContract } from '../profiles/documentation-contract.js';
import {
	registerArtifact,
	updateArtifactRecord,
} from '../state/artifact-registry.js';
import type { WorkspaceState } from '../state/workspace-state.schema.js';
import {
	requireWorkspaceState,
	updateWorkspaceState,
} from '../state/workspace-state-repository.js';
import { createHtmlArtifactPlan } from './html-artifact-planner.js';
import type {
	HtmlArtifactPlanItem,
	HtmlArtifactStatus,
} from './html-artifact-types.js';
import type {
	HtmlRenderArtifact,
	HtmlRenderInput,
	HtmlRenderStatus,
} from './html-render-types.js';
import type {
	HtmlReviewArtifactRecord,
	HtmlReviewGenerationDiagnostic,
	HtmlReviewGenerationInput,
	HtmlReviewGenerationItem,
	HtmlReviewGenerationOptions,
	HtmlReviewGenerationResult,
	HtmlReviewGenerationSecuritySummary,
	HtmlReviewGenerationStatus,
	HtmlReviewGenerationSummary,
	HtmlReviewViewDataInput,
} from './html-review-generation-types.js';
import { getViewDataBuilder } from './html-review-view-builders.js';
import { createStaticHtmlRenderer } from './static-html-renderer.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createDiagnostic(
	code: string,
	severity: 'error' | 'warning' | 'info',
	message: string,
	overrides?: Partial<HtmlReviewGenerationDiagnostic>,
): HtmlReviewGenerationDiagnostic {
	return {
		code,
		expected: undefined,
		fieldPath: undefined,
		message,
		outputPath: undefined,
		received: undefined,
		recoveryHint: undefined,
		relatedArtifactId: undefined,
		relatedArtifactKind: undefined,
		relatedPhaseId: undefined,
		relatedSourceDocumentId: undefined,
		severity,
		sourcePath: undefined,
		...overrides,
	};
}

function planStatusToRenderStatus(
	planStatus: HtmlArtifactStatus,
): HtmlRenderStatus {
	switch (planStatus) {
		case 'ready':
			return 'ready';
		case 'requires_review':
			return 'requires_review';
		case 'stale':
			return 'stale';
		case 'blocked':
			return 'blocked';
		case 'missing_source':
			return 'missing_source';
		case 'skipped':
			return 'unknown';
		case 'unknown':
			return 'unknown';
		default:
			return 'unknown';
	}
}

function resolvePlanStatusToGenerationStatus(
	planStatus: HtmlArtifactStatus,
): HtmlReviewGenerationStatus {
	switch (planStatus) {
		case 'ready':
			return 'created';
		case 'requires_review':
			return 'requires_review';
		case 'stale':
			return 'stale';
		case 'blocked':
			return 'blocked';
		case 'missing_source':
			return 'blocked';
		case 'skipped':
			return 'skipped';
		case 'unknown':
			return 'blocked';
		default:
			return 'blocked';
	}
}

function shouldRenderItem(
	status: HtmlArtifactStatus,
	options: HtmlReviewGenerationOptions | undefined,
): boolean {
	if (status === 'ready') return true;
	if (status === 'requires_review') return options?.renderReviewPages !== false;
	if (status === 'stale') return options?.renderReviewPages !== false;
	if (status === 'blocked') return options?.renderBlockedPages === true;
	if (status === 'missing_source')
		return options?.renderMissingSourcePages === true;
	if (status === 'skipped') return false;
	if (status === 'unknown') return options?.renderMissingSourcePages === true;
	return false;
}

// ---------------------------------------------------------------------------
// Security audit
// ---------------------------------------------------------------------------

export function performSecurityAudit(html: string): {
	safe: boolean;
	diagnostics: HtmlReviewGenerationDiagnostic[];
	securitySummary: {
		scriptTagCount: number;
		externalAssetCount: number;
		iframeCount: number;
		formTagCount: number;
	};
} {
	const diagnostics: HtmlReviewGenerationDiagnostic[] = [];
	let scriptTagCount = 0;
	let externalAssetCount = 0;
	let iframeCount = 0;
	let formTagCount = 0;

	const scriptMatches = html.match(/<script[\s>]/gi);
	scriptTagCount = scriptMatches ? scriptMatches.length : 0;
	if (scriptTagCount > 0) {
		diagnostics.push(
			createDiagnostic(
				'E_HTML_SECURITY_SCRIPT',
				'error',
				`Generated HTML contains ${scriptTagCount} script tag(s).`,
			),
		);
	}

	const eventRe =
		/\bon(?:load|click|error|change|submit|mouseover|mouseout|focus|blur|keydown|keyup|keypress)\s*=/i;
	if (eventRe.test(html)) {
		diagnostics.push(
			createDiagnostic(
				'E_HTML_SECURITY_INLINE_EVENT',
				'error',
				'Generated HTML contains inline event handlers.',
			),
		);
	}

	const extLinkMatches = html.match(
		/<link[^>]+rel=["']?stylesheet["']?[^>]*href=["']?https?:/gi,
	);
	if (extLinkMatches) {
		externalAssetCount += extLinkMatches.length;
		diagnostics.push(
			createDiagnostic(
				'E_HTML_SECURITY_EXTERNAL_STYLESHEET',
				'error',
				`Generated HTML contains ${extLinkMatches.length} external stylesheet(s).`,
			),
		);
	}

	const remoteFontMatches = html.match(/url\(["']?https?:/gi);
	if (remoteFontMatches) {
		externalAssetCount += remoteFontMatches.length;
		diagnostics.push(
			createDiagnostic(
				'E_HTML_SECURITY_REMOTE_FONT',
				'error',
				`Generated HTML contains ${remoteFontMatches.length} remote font reference(s).`,
			),
		);
	}

	const remoteImgMatches = html.match(/<img[^>]+src=["']?https?:/gi);
	if (remoteImgMatches) {
		diagnostics.push(
			createDiagnostic(
				'E_HTML_SECURITY_REMOTE_IMAGE',
				'error',
				`Generated HTML contains ${remoteImgMatches.length} remote image(s).`,
			),
		);
	}

	const iframeMatches = html.match(/<iframe[\s>]/gi);
	iframeCount = iframeMatches ? iframeMatches.length : 0;
	if (iframeCount > 0) {
		diagnostics.push(
			createDiagnostic(
				'E_HTML_SECURITY_IFRAME',
				'error',
				`Generated HTML contains ${iframeCount} iframe(s).`,
			),
		);
	}

	const formMatches = html.match(/<form[\s>]/gi);
	formTagCount = formMatches ? formMatches.length : 0;
	if (formTagCount > 0) {
		diagnostics.push(
			createDiagnostic(
				'E_HTML_SECURITY_FORM',
				'error',
				`Generated HTML contains ${formTagCount} form(s).`,
			),
		);
	}

	if (/href\s*=\s*["']?javascript:/i.test(html)) {
		diagnostics.push(
			createDiagnostic(
				'E_HTML_SECURITY_JAVASCRIPT_URI',
				'error',
				'Generated HTML contains javascript: URI.',
			),
		);
	}
	if (/href\s*=\s*["']?data:/i.test(html)) {
		diagnostics.push(
			createDiagnostic(
				'E_HTML_SECURITY_DATA_URI',
				'error',
				'Generated HTML contains data: URI in href.',
			),
		);
	}
	if (/href\s*=\s*["']?vbscript:/i.test(html)) {
		diagnostics.push(
			createDiagnostic(
				'E_HTML_SECURITY_VBSCRIPT_URI',
				'error',
				'Generated HTML contains vbscript: URI.',
			),
		);
	}

	return {
		diagnostics,
		safe: diagnostics.length === 0,
		securitySummary: {
			externalAssetCount,
			formTagCount,
			iframeCount,
			scriptTagCount,
		},
	};
}

// ---------------------------------------------------------------------------
// Checksum
// ---------------------------------------------------------------------------

function computeHtmlChecksum(html: string): string {
	return createHash('sha256').update(html).digest('hex').slice(0, 16);
}

// ---------------------------------------------------------------------------
// Path safety
// ---------------------------------------------------------------------------

function resolveSafeOutputPath(
	outputPath: string,
	projectRoot: string,
	documentationRoot: string,
	artifactRoot: string | undefined,
): {
	safe: boolean;
	resolvedPath: string;
	diagnostics: HtmlReviewGenerationDiagnostic[];
} {
	const diagnostics: HtmlReviewGenerationDiagnostic[] = [];
	const root = normalizeRootRelativePath(artifactRoot ?? documentationRoot);
	const normalizedOutput = outputPath.replace(/\\/g, '/');

	if (
		normalizedOutput.trim().length === 0 ||
		normalizedOutput.startsWith('/') ||
		/^[A-Za-z]:/.test(normalizedOutput)
	) {
		diagnostics.push(
			createDiagnostic(
				'E_HTML_OUTPUT_PATH_TRAVERSAL',
				'error',
				`Output path is not a safe project-relative path: ${outputPath}`,
				{ outputPath },
			),
		);
		return {
			diagnostics,
			resolvedPath: resolve(projectRoot, outputPath),
			safe: false,
		};
	}

	const cleanOutput = normalizeRootRelativePath(normalizedOutput);
	const rootPrefixedOutput =
		cleanOutput === root || cleanOutput.startsWith(`${root}/`)
			? cleanOutput
			: `${root}/${cleanOutput}`;
	const resolvedRoot = resolve(projectRoot, root);
	const target = resolve(projectRoot, rootPrefixedOutput);
	const relativeToRoot = relative(resolvedRoot, target);

	if (relativeToRoot.startsWith('..') || isAbsolute(relativeToRoot)) {
		diagnostics.push(
			createDiagnostic(
				'E_HTML_OUTPUT_PATH_TRAVERSAL',
				'error',
				`Output path travels outside the allowed root: ${outputPath}`,
				{ outputPath },
			),
		);
		return { diagnostics, resolvedPath: target, safe: false };
	}

	return { diagnostics, resolvedPath: target, safe: true };
}

function normalizeRootRelativePath(value: string): string {
	return value.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
}

// ---------------------------------------------------------------------------
// Output declaration mapping for planner input
// ---------------------------------------------------------------------------

function mapOutputsForPlanner(outputs: readonly OutputDeclaration[]): {
	documentCanonicalId: string;
	phaseId: string;
	sourcePath: string;
	fieldPath: string;
	kind: string;
	path: string;
	format: string;
	purpose: string | undefined;
	isCanonical: boolean;
	outputId: string | undefined;
	role: string | undefined;
}[] {
	return outputs.map((o) => ({
		documentCanonicalId: o.documentCanonicalId,
		fieldPath: o.fieldPath,
		format: o.format,
		isCanonical: o.isCanonical,
		kind: o.kind,
		outputId: o.outputId,
		path: o.path,
		phaseId: o.phaseId,
		purpose: o.purpose,
		role: o.role ?? undefined,
		sourcePath: o.sourcePath,
	}));
}

// ---------------------------------------------------------------------------
// View data input builder from workspace state
// ---------------------------------------------------------------------------

function buildViewDataInputFromState(
	_state: WorkspaceState,
): HtmlReviewViewDataInput {
	return {
		artifactRegistryEntryCount: _state.artifacts.length,
		assumptions: [],
		decisions: [],
		documentationRoot: _state.documentation.rootPath,
		documents: [],
		hypotheses: [],
		openQuestions: [],
		phases: [],
		profileId: _state.profile.profileId,
		profileVersion: _state.profile.profileVersion,
		risks: [],
		validationFindings: [],
	};
}

// ---------------------------------------------------------------------------
// Render input builder
// ---------------------------------------------------------------------------

import type { HtmlReviewViewDataResult } from './html-review-view-builders.js';

function buildRenderInput(
	planItem: HtmlArtifactPlanItem,
	viewData: HtmlReviewViewDataResult,
	profileId: string,
): HtmlRenderInput {
	return {
		artifactId: planItem.artifactId,
		artifactKind: planItem.artifactKind,
		decisions: viewData.decisions ?? undefined,
		diagnostics: viewData.diagnostics,
		documentCanonicalId: planItem.documentCanonicalId,
		documents: viewData.documents ?? undefined,
		isDerivedNonCanonical: true,
		outputBoundary: 'derived',
		phaseId: planItem.phaseId,
		phases: viewData.phases ?? undefined,
		profileId,
		risks: viewData.risks ?? undefined,
		sections: viewData.sections.map((s) => ({
			rendered: s.rendered,
			sectionKind: s.sectionKind,
			title: s.title,
		})),
		sourceCanonicalDocumentIds: planItem.canonicalSourceDocumentIds,
		sourceCanonicalPaths: planItem.canonicalSourceOutputPaths,
		sources: planItem.sources.map((s) => ({
			documentCanonicalId: s.documentCanonicalId,
			label: s.label,
			phaseId: s.phaseId,
			relativePath: s.outputPath,
			safeForLink: true,
			sourceId: s.sourceId,
			sourceKind: s.sourceKind,
			status: s.status,
		})),
		status: planStatusToRenderStatus(planItem.status),
		summary: viewData.summary ?? undefined,
		title: planItem.title,
		traceability: undefined,
		traceabilityBoundary: planItem.traceabilityBoundary,
		validationFindings: viewData.validationFindings ?? undefined,
	};
}

function buildMinimalRenderInput(
	planItem: HtmlArtifactPlanItem,
	profileId: string,
): HtmlRenderInput {
	return {
		artifactId: planItem.artifactId,
		artifactKind: planItem.artifactKind,
		decisions: undefined,
		diagnostics: [],
		documentCanonicalId: planItem.documentCanonicalId,
		documents: undefined,
		isDerivedNonCanonical: true,
		outputBoundary: 'derived',
		phaseId: planItem.phaseId,
		phases: undefined,
		profileId,
		risks: undefined,
		sections: [
			{
				rendered: true,
				sectionKind: 'empty_state',
				title: 'No view data builder available',
			},
		],
		sourceCanonicalDocumentIds: planItem.canonicalSourceDocumentIds,
		sourceCanonicalPaths: planItem.canonicalSourceOutputPaths,
		sources: [],
		status: planStatusToRenderStatus(planItem.status),
		summary: undefined,
		title: planItem.title,
		traceability: undefined,
		traceabilityBoundary: planItem.traceabilityBoundary,
		validationFindings: undefined,
	};
}

// ---------------------------------------------------------------------------
// Empty result helper
// ---------------------------------------------------------------------------

const EMPTY_SECURITY_SUMMARY: HtmlReviewGenerationSecuritySummary = {
	allSafe: true,
	externalAssetCount: 0,
	formTagCount: 0,
	iframeCount: 0,
	renderedFilesCount: 0,
	scriptTagCount: 0,
	unsafeHrefCount: 0,
};

function emptySummary(): HtmlReviewGenerationSummary {
	return {
		blocked: 0,
		countsByKind: {},
		created: 0,
		failed: 0,
		requiresReview: 0,
		skipped: 0,
		stale: 0,
		total: 0,
		updated: 0,
	};
}

function emptyResult(
	input: HtmlReviewGenerationInput,
	dryRun: boolean,
	diagnostics: HtmlReviewGenerationDiagnostic[],
): HtmlReviewGenerationResult {
	return {
		artifactRecords: [],
		artifactRegistryEntriesCreated: 0,
		artifactRegistryEntriesUpdated: 0,
		artifactRoot: input.options?.artifactRootOverride ?? input.artifactRoot,
		blockedPaths: [],
		changedPaths: [],
		createdPaths: [],
		diagnostics,
		documentationRoot:
			input.options?.documentationRootOverride ?? input.documentationRoot,
		dryRun,
		failedPaths: [],
		items: [],
		profileId: input.profileId,
		readOnly: true,
		securitySummary: EMPTY_SECURITY_SUMMARY,
		skippedPaths: [],
		summary: emptySummary(),
		updatedPaths: [],
	};
}

// ---------------------------------------------------------------------------
// Dry-run plan
// ---------------------------------------------------------------------------

async function generateHtmlReviewDryRun(
	input: HtmlReviewGenerationInput,
	planItems: HtmlArtifactPlanItem[],
): Promise<HtmlReviewGenerationResult> {
	const diagnostics: HtmlReviewGenerationDiagnostic[] = [];
	const items: HtmlReviewGenerationItem[] = [];
	const createdPaths: string[] = [];
	const updatedPaths: string[] = [];
	const skippedPaths: string[] = [];
	const blockedPaths: string[] = [];
	const failedPaths: string[] = [];
	const projectRoot = resolve(input.projectRoot);
	const docRoot =
		input.options?.documentationRootOverride ?? input.documentationRoot;
	const artRoot = input.options?.artifactRootOverride ?? input.artifactRoot;

	const summary = emptySummary();
	summary.total = planItems.length;

	for (const planItem of planItems) {
		const genStatus = resolvePlanStatusToGenerationStatus(planItem.status);
		const render = shouldRenderItem(planItem.status, input.options);

		const pathCheck = resolveSafeOutputPath(
			planItem.relativeOutputPath,
			projectRoot,
			docRoot,
			artRoot,
		);

		if (!pathCheck.safe) {
			diagnostics.push(...pathCheck.diagnostics);
			failedPaths.push(planItem.relativeOutputPath);
			summary.failed++;
			summary.countsByKind[planItem.artifactKind] =
				(summary.countsByKind[planItem.artifactKind] ?? 0) + 1;
			continue;
		}

		const item: HtmlReviewGenerationItem = {
			action: planItem.action,
			artifactId: planItem.artifactId,
			artifactKind: planItem.artifactKind,
			blockers: planItem.blockers.map((b) => `[${b.code}] ${b.message}`),
			checksum: undefined,
			diagnostics: planItem.diagnostics.map((d) => ({
				code: d.code,
				fieldPath: d.fieldPath,
				message: d.message,
				outputPath: planItem.relativeOutputPath,
				recoveryHint: d.recoveryHint,
				relatedArtifactId: d.relatedArtifactId,
				relatedArtifactKind: d.relatedArtifactKind,
				relatedPhaseId: d.relatedPhaseId,
				relatedSourceDocumentId: d.relatedSourceDocumentId,
				severity: d.severity,
				sourcePath: d.sourcePath,
			})),
			documentCanonicalId: planItem.documentCanonicalId,
			outputPath: pathCheck.resolvedPath,
			phaseId: planItem.phaseId,
			registryEntryCreated: false,
			registryEntryUpdated: false,
			relativeOutputPath: planItem.relativeOutputPath,
			rendered: false,
			securitySafe: true,
			sourceCanonicalDocumentIds: planItem.canonicalSourceDocumentIds,
			sourceCanonicalPaths: planItem.canonicalSourceOutputPaths,
			status: genStatus,
			title: planItem.title,
			written: false,
		};

		if (!render) {
			if (
				planItem.status === 'blocked' ||
				planItem.status === 'missing_source' ||
				planItem.status === 'unknown'
			) {
				blockedPaths.push(planItem.relativeOutputPath);
				summary.blocked++;
			} else {
				skippedPaths.push(planItem.relativeOutputPath);
				summary.skipped++;
			}
		} else {
			if (genStatus === 'created') {
				createdPaths.push(planItem.relativeOutputPath);
				summary.created++;
			} else if (genStatus === 'requires_review') {
				createdPaths.push(planItem.relativeOutputPath);
				summary.requiresReview++;
			} else if (genStatus === 'stale') {
				createdPaths.push(planItem.relativeOutputPath);
				summary.stale++;
			}
			item.rendered = true;
		}

		summary.countsByKind[planItem.artifactKind] =
			(summary.countsByKind[planItem.artifactKind] ?? 0) + 1;
		items.push(item);
	}

	return {
		artifactRecords: [],
		artifactRegistryEntriesCreated: 0,
		artifactRegistryEntriesUpdated: 0,
		artifactRoot: artRoot,
		blockedPaths,
		changedPaths: [],
		createdPaths,
		diagnostics,
		documentationRoot: docRoot,
		dryRun: true,
		failedPaths,
		items,
		profileId: input.profileId,
		readOnly: true,
		securitySummary: {
			allSafe: true,
			externalAssetCount: 0,
			formTagCount: 0,
			iframeCount: 0,
			renderedFilesCount: 0,
			scriptTagCount: 0,
			unsafeHrefCount: 0,
		},
		skippedPaths,
		summary,
		updatedPaths,
	};
}

// ---------------------------------------------------------------------------
// Main generation function
// ---------------------------------------------------------------------------

export async function generateHtmlReviewViews(
	input: HtmlReviewGenerationInput,
): Promise<HtmlReviewGenerationResult> {
	const diagnostics: HtmlReviewGenerationDiagnostic[] = [];
	const projectRoot = resolve(input.projectRoot);
	const docRoot =
		input.options?.documentationRootOverride ?? input.documentationRoot;
	const artRoot = input.options?.artifactRootOverride ?? input.artifactRoot;
	const dryRun = input.options?.dryRun ?? false;
	const writePolicy: SafeWritePolicy =
		input.options?.writePolicy ?? 'overwrite';
	const generatedAt =
		input.options?.generatedAt ??
		input.options?.deterministicTimestamp ??
		new Date().toISOString();
	const idPrefix = input.options?.deterministicIdPrefix ?? 'html-gen';

	const renderer = createStaticHtmlRenderer();

	// 1. Load workspace state + contract + graph
	let state: WorkspaceState;
	let planItems: HtmlArtifactPlanItem[];

	try {
		state = await requireWorkspaceState({ projectRoot });

		const contract = await loadDocumentationContract({
			profileId: input.profileId,
			repoRoot: projectRoot,
		});
		const graphResult = buildContractGraph(contract);

		const mappedOutputs = mapOutputsForPlanner(graphResult.graph.outputs);

		const planOptions: Record<string, unknown> = {
			documentationRootOverride: docRoot,
			dryRun: false,
			generatedAt,
		};
		if (artRoot !== undefined) {
			planOptions.artifactRootOverride = artRoot;
		}

		const planResult = createHtmlArtifactPlan(
			{
				artifactRegistryEntries: state.artifacts.map((a) => ({
					artifactId: a.artifactId,
					artifactType: a.artifactType,
					checksum: a.checksum,
					generatedAt: a.generatedAt,
					isCanonical: a.isCanonical,
					metadata: a.metadata as Record<string, unknown> | undefined,
					path: a.path,
					runId: a.runId,
					sourceDocumentIds: a.sourceDocumentIds,
					status: a.status,
				})),
				artifactRoot: artRoot,
				contract: {
					documents: contract.documents.map((d) => ({
						canonicalId: d.canonicalId,
						descriptorId: d.descriptor.id,
						outputArtifacts:
							d.descriptor.outputs.artifacts?.map((a) => ({
								audience: a.audience,
								format: a.format,
								generationMode: a.generationMode,
								id: a.id,
								includes: a.includes,
								path: a.path,
								purpose: a.purpose,
							})) ?? [],
						phaseId: d.phaseId,
						sourcePath: d.sourcePath,
						status: d.descriptor.status,
						title: d.descriptor.title,
					})),
					phases: contract.phases.map((p) => ({
						documents: p.documents.map((d) => ({
							canonicalId: d.id,
							phaseId: p.id,
							sourcePath: d.file,
							status: 'unknown',
							title: d.title,
						})),
						generatedOutputs: {},
						id: p.id,
						order: p.order,
						sourcePath: p.sourcePath,
						title: p.title,
					})),
				},
				contractGraph: {
					getOutputsByDocumentId(docId: string): {
						documentCanonicalId: string;
						phaseId: string;
						sourcePath: string;
						fieldPath: string;
						kind: string;
						path: string;
						format: string;
						purpose: string | undefined;
						isCanonical: boolean;
						outputId: string | undefined;
						role: string | undefined;
					}[] {
						return mappedOutputs.filter((o) => o.documentCanonicalId === docId);
					},
					outputs: mappedOutputs,
				},
				dependencyGraph: { nodes: [] },
				documentationRoot: docRoot,
				executiveConfig: undefined,
				manualEditCollisions: undefined,
				profileId: input.profileId,
				regenerationPlan: undefined,
				registerSummary: undefined,
				stalenessResult: undefined,
				traceabilityMetadata: undefined,
				validationFindings: [],
			},
			planOptions as unknown as import('./html-artifact-types.js').HtmlArtifactPlanOptions,
		);

		planItems = planResult.plan.items;

		for (const diag of planResult.diagnostics) {
			diagnostics.push(
				createDiagnostic(diag.code, diag.severity, diag.message, {
					fieldPath: diag.fieldPath,
					recoveryHint: diag.recoveryHint,
					relatedArtifactId: diag.relatedArtifactId,
					relatedArtifactKind: diag.relatedArtifactKind,
					relatedPhaseId: diag.relatedPhaseId,
					relatedSourceDocumentId: diag.relatedSourceDocumentId,
					sourcePath: diag.sourcePath,
				}),
			);
		}
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		diagnostics.push(
			createDiagnostic('E_HTML_GEN_PLAN_FAILED', 'error', message),
		);
		return emptyResult(input, dryRun, diagnostics);
	}

	// Dry-run
	if (dryRun) {
		return generateHtmlReviewDryRun(input, planItems);
	}

	// 4. Execute generation
	const items: HtmlReviewGenerationItem[] = [];
	const createdPaths: string[] = [];
	const updatedPaths: string[] = [];
	const skippedPaths: string[] = [];
	const blockedPaths: string[] = [];
	const failedPaths: string[] = [];
	const changedPaths: string[] = [];
	const artifactRecords: HtmlReviewArtifactRecord[] = [];
	let artifactRegistryEntriesCreated = 0;
	let artifactRegistryEntriesUpdated = 0;

	const summary = emptySummary();
	summary.total = planItems.length;

	const securitySummary: HtmlReviewGenerationSecuritySummary = {
		allSafe: true,
		externalAssetCount: 0,
		formTagCount: 0,
		iframeCount: 0,
		renderedFilesCount: 0,
		scriptTagCount: 0,
		unsafeHrefCount: 0,
	};

	let idCounter = 0;
	const artIdFactory = (): string =>
		`${idPrefix}-art-${Date.now()}-${(idCounter++).toString(36)}`;

	for (const planItem of planItems) {
		const genStatus = resolvePlanStatusToGenerationStatus(planItem.status);
		const render = shouldRenderItem(planItem.status, input.options);

		const pathCheck = resolveSafeOutputPath(
			planItem.relativeOutputPath,
			projectRoot,
			docRoot,
			artRoot,
		);

		const baseItem: HtmlReviewGenerationItem = {
			action: planItem.action,
			artifactId: planItem.artifactId,
			artifactKind: planItem.artifactKind,
			blockers: planItem.blockers.map((b) => `[${b.code}] ${b.message}`),
			checksum: undefined,
			diagnostics: planItem.diagnostics.map((d) => ({
				code: d.code,
				fieldPath: d.fieldPath,
				message: d.message,
				outputPath: planItem.relativeOutputPath,
				recoveryHint: d.recoveryHint,
				relatedArtifactId: d.relatedArtifactId,
				relatedArtifactKind: d.relatedArtifactKind,
				relatedPhaseId: d.relatedPhaseId,
				relatedSourceDocumentId: d.relatedSourceDocumentId,
				severity: d.severity,
				sourcePath: d.sourcePath,
			})),
			documentCanonicalId: planItem.documentCanonicalId,
			outputPath: pathCheck.resolvedPath,
			phaseId: planItem.phaseId,
			registryEntryCreated: false,
			registryEntryUpdated: false,
			relativeOutputPath: planItem.relativeOutputPath,
			rendered: false,
			securitySafe: true,
			sourceCanonicalDocumentIds: planItem.canonicalSourceDocumentIds,
			sourceCanonicalPaths: planItem.canonicalSourceOutputPaths,
			status: genStatus,
			title: planItem.title,
			written: false,
		};

		if (!pathCheck.safe) {
			diagnostics.push(...pathCheck.diagnostics);
			failedPaths.push(planItem.relativeOutputPath);
			summary.failed++;
			baseItem.diagnostics.push(...pathCheck.diagnostics);
			baseItem.status = 'failed';
			items.push(baseItem);
			continue;
		}

		if (!render) {
			if (
				planItem.status === 'blocked' ||
				planItem.status === 'missing_source' ||
				planItem.status === 'unknown'
			) {
				blockedPaths.push(planItem.relativeOutputPath);
				summary.blocked++;
			} else {
				skippedPaths.push(planItem.relativeOutputPath);
				summary.skipped++;
			}
			summary.countsByKind[planItem.artifactKind] =
				(summary.countsByKind[planItem.artifactKind] ?? 0) + 1;
			items.push(baseItem);
			continue;
		}

		// 5. Build view data
		const viewDataBuilder = getViewDataBuilder(planItem.artifactKind);
		let renderInput: HtmlRenderInput;

		if (viewDataBuilder) {
			try {
				const viewDataInput = buildViewDataInputFromState(state);
				const viewData = viewDataBuilder(viewDataInput, planItem.artifactKind);
				renderInput = buildRenderInput(
					planItem,
					viewData,
					state.profile.profileId,
				);
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				baseItem.diagnostics.push(
					createDiagnostic(
						'E_HTML_VIEW_DATA_BUILD_FAILED',
						'error',
						`Failed to build view data for ${planItem.artifactKind}: ${msg}`,
						{
							outputPath: planItem.relativeOutputPath,
							relatedArtifactId: planItem.artifactId,
							relatedArtifactKind: planItem.artifactKind,
						},
					),
				);
				baseItem.status = 'failed';
				failedPaths.push(planItem.relativeOutputPath);
				summary.failed++;
				items.push(baseItem);
				continue;
			}
		} else {
			renderInput = buildMinimalRenderInput(planItem, state.profile.profileId);
		}

		// 6. Render
		let renderResult: HtmlRenderArtifact;
		try {
			renderResult = renderer.renderStaticHtmlArtifact(renderInput, {
				generatedAt,
				profileVersion: state.profile.profileVersion,
				renderedAt: generatedAt,
			});
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			baseItem.diagnostics.push(
				createDiagnostic(
					'E_HTML_RENDER_FAILED',
					'error',
					`Renderer failed: ${msg}`,
					{
						outputPath: planItem.relativeOutputPath,
						relatedArtifactId: planItem.artifactId,
						relatedArtifactKind: planItem.artifactKind,
					},
				),
			);
			baseItem.status = 'failed';
			failedPaths.push(planItem.relativeOutputPath);
			summary.failed++;
			items.push(baseItem);
			continue;
		}

		// 7. Security audit
		const audit = performSecurityAudit(renderResult.html);
		baseItem.diagnostics.push(...audit.diagnostics);

		securitySummary.scriptTagCount += audit.securitySummary.scriptTagCount;
		securitySummary.externalAssetCount +=
			audit.securitySummary.externalAssetCount;
		securitySummary.iframeCount += audit.securitySummary.iframeCount;
		securitySummary.formTagCount += audit.securitySummary.formTagCount;

		if (!audit.safe) {
			baseItem.securitySafe = false;
			baseItem.status = 'failed';
			failedPaths.push(planItem.relativeOutputPath);
			summary.failed++;
			items.push(baseItem);
			continue;
		}

		baseItem.rendered = true;
		baseItem.securitySafe = true;

		// 8. Write file
		const writeResult = await writeFileAtomic(
			pathCheck.resolvedPath,
			renderResult.html,
			{
				_testTimestamp: generatedAt,
				allowedBaseDir: projectRoot,
				dryRun: false,
				policy: writePolicy,
			},
		);

		for (const diag of writeResult.diagnostics) {
			baseItem.diagnostics.push(
				createDiagnostic(
					`E_HTML_WRITE_${diag.code.toUpperCase()}`,
					diag.severity,
					diag.message,
					{
						outputPath: planItem.relativeOutputPath,
						recoveryHint: diag.recoveryHint,
					},
				),
			);
		}

		if (!writeResult.success) {
			baseItem.status = 'failed';
			failedPaths.push(planItem.relativeOutputPath);
			summary.failed++;
			items.push(baseItem);
			continue;
		}

		baseItem.written = true;
		baseItem.checksum = computeHtmlChecksum(renderResult.html);

		for (const cp of writeResult.changedPaths) {
			if (
				cp.role === 'file_created' ||
				cp.role === 'file_updated' ||
				cp.role === 'backup_created'
			) {
				changedPaths.push(cp.path);
			}
		}

		// 9. Update artifact registry
		const existingArtifact = state.artifacts.find(
			(a) =>
				a.artifactType === 'html' && a.path === planItem.relativeOutputPath,
		);

		if (existingArtifact) {
			const updateResult = updateArtifactRecord({
				artifactId: existingArtifact.artifactId,
				state,
				updates: {
					checksum: baseItem.checksum,
					generatedAt,
					isCanonical: false,
					metadata: {
						artifactId: planItem.artifactId,
						artifactKind: planItem.artifactKind,
						sourceCanonicalDocumentIds: planItem.canonicalSourceDocumentIds,
						sourceCanonicalPaths: planItem.canonicalSourceOutputPaths,
						traceabilityBoundary: planItem.traceabilityBoundary,
					},
					path: planItem.relativeOutputPath,
					sourceDocumentIds: planItem.canonicalSourceDocumentIds,
					status: 'generated' as const,
				},
			});

			if (updateResult.found) {
				state = updateResult.state;
				baseItem.registryEntryUpdated = true;
				artifactRegistryEntriesUpdated++;
			}
		} else {
			const regResult = registerArtifact({
				idFactory: artIdFactory,
				input: {
					artifactType: 'html',
					checksum: baseItem.checksum,
					generatedAt,
					isCanonical: false,
					metadata: {
						artifactId: planItem.artifactId,
						artifactKind: planItem.artifactKind,
						sourceCanonicalDocumentIds: planItem.canonicalSourceDocumentIds,
						sourceCanonicalPaths: planItem.canonicalSourceOutputPaths,
						traceabilityBoundary: planItem.traceabilityBoundary,
					},
					path: planItem.relativeOutputPath,
					sourceDocumentIds: planItem.canonicalSourceDocumentIds,
					status: 'generated',
				},
				state,
			});

			state = regResult.state;
			baseItem.registryEntryCreated = true;
			artifactRegistryEntriesCreated++;
		}

		const artifactRecord: HtmlReviewArtifactRecord = {
			artifactId: planItem.artifactId,
			artifactKind: planItem.artifactKind,
			checksum: baseItem.checksum,
			generatedAt,
			isCanonical: false,
			outputPath: pathCheck.resolvedPath,
			profileId: input.profileId,
			profileVersion: state.profile.profileVersion,
			relativeOutputPath: planItem.relativeOutputPath,
			sourceCanonicalDocumentIds: planItem.canonicalSourceDocumentIds,
			sourceCanonicalPaths: planItem.canonicalSourceOutputPaths,
			status: genStatus,
			traceabilitySummary: planItem.traceabilityBoundary,
		};
		artifactRecords.push(artifactRecord);

		if (
			genStatus === 'created' ||
			genStatus === 'requires_review' ||
			genStatus === 'stale'
		) {
			createdPaths.push(planItem.relativeOutputPath);
			securitySummary.renderedFilesCount++;
		}

		if (genStatus === 'created') summary.created++;
		else if (genStatus === 'updated') summary.updated++;
		else if (genStatus === 'requires_review') summary.requiresReview++;
		else if (genStatus === 'stale') summary.stale++;

		summary.countsByKind[planItem.artifactKind] =
			(summary.countsByKind[planItem.artifactKind] ?? 0) + 1;
		items.push(baseItem);
	}

	// 10. Persist state if artifacts were registered
	if (
		artifactRegistryEntriesCreated > 0 ||
		artifactRegistryEntriesUpdated > 0
	) {
		try {
			const persisted = await updateWorkspaceState({
				clock: {
					now: () => generatedAt,
				},
				policy: 'overwrite',
				projectRoot,
				updater: () => state,
			});

			if (persisted.success) {
				for (const cp of persisted.changedPaths) {
					if (!changedPaths.includes(cp)) {
						changedPaths.push(cp);
					}
				}
			}
		} catch {
			// State persistence failure is not fatal for generation
		}
	}

	securitySummary.allSafe =
		securitySummary.scriptTagCount === 0 &&
		securitySummary.externalAssetCount === 0 &&
		securitySummary.iframeCount === 0 &&
		securitySummary.formTagCount === 0;

	return {
		artifactRecords,
		artifactRegistryEntriesCreated,
		artifactRegistryEntriesUpdated,
		artifactRoot: artRoot,
		blockedPaths,
		changedPaths,
		createdPaths,
		diagnostics,
		documentationRoot: docRoot,
		dryRun,
		failedPaths,
		items,
		profileId: input.profileId,
		readOnly: true,
		securitySummary,
		skippedPaths,
		summary,
		updatedPaths,
	};
}
