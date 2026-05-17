/** Generate Canonical Docs — orchestration for /generate slash command */

import { resolve } from 'node:path';
import { buildContractGraph } from '../profiles/contract-graph.js';
import { loadDocumentationContract } from '../profiles/documentation-contract.js';
import { registerArtifact } from '../state/artifact-registry.js';
import { createRunRecord } from '../state/run-repository.js';
import { createSessionRecord } from '../state/session-repository.js';
import { WORKSPACE_STATE_SCHEMA_VERSION } from '../state/workspace-state.schema.js';
import {
	requireWorkspaceState,
	updateWorkspaceState,
} from '../state/workspace-state-repository.js';
import { renderCanonicalMarkdownFromPlan } from './canonical-markdown-renderer.js';
import type {
	GenerateCanonicalDocsDiagnostic,
	GenerateCanonicalDocsDryRunResult,
	GenerateCanonicalDocsOptions,
	GenerateCanonicalDocsPreflight,
	GenerateCanonicalDocsReportItem,
	GenerateCanonicalDocsResult,
} from './generate-types.js';
import { createGenerationPlan } from './generation-planner.js';
import type { GenerationPlan } from './generation-planner-types.js';
import type {
	MarkdownWritePlanItem,
	MarkdownWriteStatus,
	SafeMarkdownWritePolicy,
} from './markdown-writer-types.js';
import {
	planMarkdownWrites,
	writeMarkdownDocuments,
} from './safe-markdown-writer.js';

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_WRITE_POLICY: SafeMarkdownWritePolicy = 'fail';
const DEFAULT_DOCUMENTATION_ROOT = 'logos/';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createDiagnostic(
	code: string,
	severity: GenerateCanonicalDocsDiagnostic['severity'],
	message: string,
	documentId?: string,
	path?: string,
	sourcePath?: string,
	recoveryHint?: string,
): GenerateCanonicalDocsDiagnostic {
	const d: GenerateCanonicalDocsDiagnostic = { code, message, severity };
	if (documentId !== undefined) d.documentId = documentId;
	if (path !== undefined) d.path = path;
	if (sourcePath !== undefined) d.sourcePath = sourcePath;
	if (recoveryHint !== undefined) d.recoveryHint = recoveryHint;
	return d;
}

function deterministicIdFactory(
	prefix: string,
	counter: { n: number },
): () => string {
	return () => `${prefix}-${Date.now()}-${(counter.n++).toString(36)}`;
}

// ---------------------------------------------------------------------------
// Preflight
// ---------------------------------------------------------------------------

export async function planGenerateCanonicalDocs(
	options: GenerateCanonicalDocsOptions,
): Promise<GenerateCanonicalDocsPreflight> {
	const diagnostics: GenerateCanonicalDocsDiagnostic[] = [];
	const projectRoot = resolve(options.projectRoot);
	let profileId = 'standard';
	let documentationRoot = DEFAULT_DOCUMENTATION_ROOT;

	try {
		const state = await requireWorkspaceState({ projectRoot });
		profileId = state.profile.profileId;
		documentationRoot =
			state.documentation.rootPath || DEFAULT_DOCUMENTATION_ROOT;

		const contract = await loadDocumentationContract({
			profileId,
			repoRoot: projectRoot,
		});
		const graphResult = buildContractGraph(contract);

		const planOptions: {
			documentationRootOverride: string;
			dryRun: boolean;
			generatedAt?: string;
		} = {
			documentationRootOverride: documentationRoot,
			dryRun: true,
		};
		if (options.deterministicTimestamp) {
			planOptions.generatedAt = options.deterministicTimestamp;
		}

		const planResult = createGenerationPlan(
			{ contract, graph: graphResult.graph, state },
			planOptions,
		);

		const plan = planResult.plan;
		const eligibleItems = plan.items.filter((item) =>
			isEligibleForRendering(item.action),
		);

		const targetPaths = eligibleItems
			.map((item) => item.documentationRootRelativePath)
			.filter(Boolean);

		// Convert plan diagnostics
		for (const diag of plan.diagnostics) {
			diagnostics.push(
				createDiagnostic(
					diag.code,
					diag.severity,
					diag.message,
					diag.sourceDocumentId,
					diag.sourcePath,
					diag.fieldPath,
					diag.recoveryHint,
				),
			);
		}

		// Detect manual edits / collisions using writer planning
		const collisionPaths: string[] = [];
		const manualEditPaths: string[] = [];

		if (eligibleItems.length > 0) {
			const renderResults = renderCanonicalMarkdownFromPlan(
				{
					contractDocuments: buildContractDocMap(contract),
					plan,
					profileId,
					schemaVersion: state.schemaVersion || WORKSPACE_STATE_SCHEMA_VERSION,
					state,
				},
				buildRenderOptions(options),
			);

			const writePlan = await planMarkdownWrites(
				{
					planItems: eligibleItems,
					renderResults,
				},
				{
					deterministicRandomId: options.deterministicIdPrefix
						? `${options.deterministicIdPrefix}-0`
						: undefined,
					deterministicTimestamp: options.deterministicTimestamp,
					documentationRoot,
					dryRun: true,
					policy: options.writePolicy ?? DEFAULT_WRITE_POLICY,
					projectRoot,
				},
			);

			for (const item of writePlan.items) {
				if (item.status === 'collision' || item.collision !== undefined) {
					collisionPaths.push(item.targetPath);
				}
				if (
					item.manualEditStatus !== undefined &&
					item.manualEditStatus !== 'new_file' &&
					item.manualEditStatus !== 'unchanged_generated'
				) {
					manualEditPaths.push(item.targetPath);
				}
			}
		}

		return {
			collisionPaths,
			diagnostics,
			documentationRoot,
			documentCounts: plan.actionCounts,
			manualEditPaths,
			mode: 'preflight',
			needsConfirmation: true,
			profileId,
			targetPaths,
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		diagnostics.push(
			createDiagnostic(
				'E_GEN_PREFLIGHT_FAILED',
				'error',
				message,
				undefined,
				undefined,
				undefined,
				'Ensure the workspace is initialized with /init and a valid profile is loaded.',
			),
		);

		return {
			collisionPaths: [],
			diagnostics,
			documentationRoot,
			documentCounts: {
				blocked: 0,
				failed: 0,
				generate: 0,
				incomplete: 0,
				skip: 0,
				stale: 0,
				update: 0,
			},
			manualEditPaths: [],
			mode: 'preflight',
			needsConfirmation: true,
			profileId,
			targetPaths: [],
		};
	}
}

// ---------------------------------------------------------------------------
// Execute
// ---------------------------------------------------------------------------

export async function executeGenerateCanonicalDocs(
	options: GenerateCanonicalDocsOptions,
): Promise<GenerateCanonicalDocsResult> {
	const diagnostics: GenerateCanonicalDocsDiagnostic[] = [];
	const projectRoot = resolve(options.projectRoot);
	const writePolicy = options.writePolicy ?? DEFAULT_WRITE_POLICY;
	const idCounter = { n: 0 };
	const idPrefix = options.deterministicIdPrefix ?? 'gen';
	const runIdFactory = deterministicIdFactory(`${idPrefix}-run`, idCounter);
	const artifactIdFactory = deterministicIdFactory(
		`${idPrefix}-art`,
		idCounter,
	);

	const changedPaths: string[] = [];

	let state = await requireWorkspaceState({ projectRoot });
	const profileId = state.profile.profileId;
	const documentationRoot =
		state.documentation.rootPath || DEFAULT_DOCUMENTATION_ROOT;

	const contract = await loadDocumentationContract({
		profileId,
		repoRoot: projectRoot,
	});
	const graphResult = buildContractGraph(contract);

	const planExecOptions: {
		documentationRootOverride: string;
		dryRun: boolean;
		generatedAt?: string;
	} = {
		documentationRootOverride: documentationRoot,
		dryRun: false,
	};
	if (options.deterministicTimestamp) {
		planExecOptions.generatedAt = options.deterministicTimestamp;
	}

	const planResult = createGenerationPlan(
		{ contract, graph: graphResult.graph, state },
		planExecOptions,
	);

	const plan = planResult.plan;

	// Convert plan diagnostics
	for (const diag of plan.diagnostics) {
		diagnostics.push(
			createDiagnostic(
				diag.code,
				diag.severity,
				diag.message,
				diag.sourceDocumentId,
				diag.sourcePath,
				diag.fieldPath,
				diag.recoveryHint,
			),
		);
	}

	// Filter eligible items
	const eligibleItems = plan.items.filter((item) =>
		isEligibleForRendering(item.action),
	);

	// Render eligible items
	const renderResults = renderCanonicalMarkdownFromPlan(
		{
			contractDocuments: buildContractDocMap(contract),
			plan,
			profileId,
			schemaVersion: state.schemaVersion || WORKSPACE_STATE_SCHEMA_VERSION,
			state,
		},
		buildRenderOptions(options),
	);

	// Write rendered documents
	const writeResult = await writeMarkdownDocuments(
		{
			planItems: eligibleItems,
			renderResults,
		},
		{
			deterministicRandomId: options.deterministicIdPrefix
				? `${options.deterministicIdPrefix}-wr`
				: undefined,
			deterministicTimestamp: options.deterministicTimestamp,
			documentationRoot,
			dryRun: false,
			policy: writePolicy,
			projectRoot,
		},
	);

	const writtenItems = writeResult.items;
	const artifactIds: string[] = [];

	// Collect changed paths from writer
	for (const cp of writeResult.changedPaths) {
		if (cp.role !== 'planned') {
			changedPaths.push(cp.path);
		}
	}

	// Classify outcomes
	const createdPaths: string[] = [];
	const updatedPaths: string[] = [];
	const skippedPaths: string[] = [];
	const incompleteDocumentIds: string[] = [];
	const blockedDocumentIds: string[] = [];
	const failedDocumentIds: string[] = [];
	const staleDocumentIds: string[] = [];
	const collisionPaths: string[] = [];

	for (const item of plan.items) {
		switch (item.action) {
			case 'incomplete':
				incompleteDocumentIds.push(item.documentCanonicalId);
				break;
			case 'blocked':
				blockedDocumentIds.push(item.documentCanonicalId);
				break;
			case 'failed':
				failedDocumentIds.push(item.documentCanonicalId);
				break;
			case 'stale':
				staleDocumentIds.push(item.documentCanonicalId);
				break;
		}
	}

	for (const wi of writtenItems) {
		switch (wi.status) {
			case 'created':
				createdPaths.push(wi.targetPath);
				break;
			case 'updated':
				updatedPaths.push(wi.targetPath);
				break;
			case 'skipped':
				skippedPaths.push(wi.targetPath);
				break;
			case 'collision':
				collisionPaths.push(wi.targetPath);
				break;
		}
	}

	// Build report items
	const reportItems: GenerateCanonicalDocsReportItem[] = buildReportItems(
		plan.items,
		writtenItems,
		renderResults,
	);

	// Register artifacts for written items
	for (const wi of writtenItems) {
		if (wi.status === 'created' || wi.status === 'updated') {
			const artResult = registerArtifact({
				idFactory: artifactIdFactory,
				input: {
					artifactType: 'canonical_markdown',
					generatedAt:
						options.deterministicTimestamp ?? new Date().toISOString(),
					isCanonical: true,
					path: wi.targetPath,
					runId: '', // filled after run is created
					sourceDocumentIds: [wi.documentCanonicalId],
					status: 'generated',
				},
				state,
			});

			state = artResult.state;
			artifactIds.push(artResult.artifact.artifactId);
		}
	}

	// Create generation run record
	const runResult = createRunRecord({
		clock: {
			now: () => options.deterministicTimestamp ?? new Date().toISOString(),
		},
		idFactory: runIdFactory,
		input: {
			changedPaths: [...changedPaths],
			command: '/generate',
			completedAt: options.deterministicTimestamp ?? new Date().toISOString(),
			dryRun: false,
			relatedArtifactIds: [...artifactIds],
			runType: 'generation',
			status: 'completed',
			warnings: writeResult.diagnostics
				.filter((d) => d.severity === 'warning')
				.map((d) => d.message),
		},
		state,
	});

	state = runResult.state;
	const runId = runResult.run.runId;

	// Update artifact records with runId
	for (const artId of artifactIds) {
		state = {
			...state,
			artifacts: state.artifacts.map((a) =>
				a.artifactId === artId ? { ...a, runId } : a,
			),
		};
	}

	// Create session record
	const sessionResult = createSessionRecord({
		clock: {
			now: () => options.deterministicTimestamp ?? new Date().toISOString(),
		},
		idFactory: deterministicIdFactory(`${idPrefix}-sess`, { n: 0 }),
		input: {
			commandOrTrigger: '/generate',
			relatedArtifactIds: [...artifactIds],
			relatedRunIds: [runId],
			sessionType: 'generation',
			status: 'completed',
		},
		state,
	});

	state = sessionResult.state;

	// Persist updated workspace state
	const persisted = await updateWorkspaceState({
		clock: {
			now: () => options.deterministicTimestamp ?? new Date().toISOString(),
		},
		policy: 'overwrite',
		projectRoot,
		updater: () => state,
	});

	if (!persisted.success) {
		const diags = persisted.diagnostics
			.map((d) => `[${d.code}] ${d.message}`)
			.join('; ');
		diagnostics.push(
			createDiagnostic(
				'E_GEN_PERSIST_FAILED',
				'error',
				`Failed to persist workspace state: ${diags}`,
			),
		);
	} else if (persisted.state) {
		// Verify runs were persisted by checking the returned state
		if (
			persisted.state.runs.length === 0 &&
			persisted.state.generationRuns.length === 0
		) {
			diagnostics.push(
				createDiagnostic(
					'E_GEN_PERSIST_NO_RUNS',
					'error',
					`Persisted state has no runs. Before persist: runs=${state.runs.length}, genRuns=${state.generationRuns.length}`,
				),
			);
		}
	}

	for (const cp of persisted.changedPaths) {
		if (!changedPaths.includes(cp)) {
			changedPaths.push(cp);
		}
	}

	// Collect writer diagnostics
	for (const wd of writeResult.diagnostics) {
		diagnostics.push(
			createDiagnostic(
				wd.code,
				wd.severity,
				wd.message,
				wd.documentCanonicalId,
				wd.targetPath,
				undefined,
				wd.recoveryHint,
			),
		);
	}

	return {
		artifactIds,
		blockedDocumentIds,
		changedPaths: [...new Set(changedPaths)],
		collisionPaths,
		createdPaths,
		diagnostics,
		documentationRoot,
		failedDocumentIds,
		incompleteDocumentIds,
		items: reportItems,
		mode: 'execute',
		profileId,
		runId,
		skippedPaths,
		staleDocumentIds,
		suggestedNextCommands: [
			'/status',
			'/validate (future)',
			'/diagnose (future)',
		],
		updatedPaths,
		writePlanSummary: writeResult.summary,
		writePolicy,
	};
}

// ---------------------------------------------------------------------------
// Main entry point — routes based on mode
// ---------------------------------------------------------------------------

export async function generateCanonicalDocs(
	options: GenerateCanonicalDocsOptions,
): Promise<
	| GenerateCanonicalDocsPreflight
	| GenerateCanonicalDocsResult
	| GenerateCanonicalDocsDryRunResult
> {
	switch (options.mode) {
		case 'preflight':
			return planGenerateCanonicalDocs(options);
		case 'execute':
			return executeGenerateCanonicalDocs(options);
		case 'dry_run':
			return planDryRun(options);
	}
}

// ---------------------------------------------------------------------------
// Dry-Run
// ---------------------------------------------------------------------------

async function planDryRun(
	options: GenerateCanonicalDocsOptions,
): Promise<GenerateCanonicalDocsDryRunResult> {
	const preflight = await planGenerateCanonicalDocs({
		...options,
		mode: 'preflight',
	});

	return {
		collisionPaths: preflight.collisionPaths,
		diagnostics: preflight.diagnostics,
		documentationRoot: preflight.documentationRoot,
		documentCounts: preflight.documentCounts,
		mode: 'dry_run',
		profileId: preflight.profileId,
		targetPaths: preflight.targetPaths,
		writePlanSummary: {
			collisions: preflight.collisionPaths.length,
			created: preflight.documentCounts.generate,
			failed: preflight.documentCounts.failed,
			skipped: preflight.documentCounts.skip,
			total: preflight.targetPaths.length,
			updated: preflight.documentCounts.update,
		},
		writePolicy: options.writePolicy ?? DEFAULT_WRITE_POLICY,
	};
}

// ---------------------------------------------------------------------------
// Eligibility
// ---------------------------------------------------------------------------

function isEligibleForRendering(action: string): boolean {
	return (
		action === 'generate' ||
		action === 'update' ||
		action === 'stale' ||
		action === 'incomplete'
	);
}

// ---------------------------------------------------------------------------
// Report item building
// ---------------------------------------------------------------------------

function buildReportItems(
	planItems: GenerationPlan['items'],
	writtenItems: MarkdownWritePlanItem[],
	renderResults: {
		documentCanonicalId: string;
		markdown: string;
		metadata: { documentId?: string } | null;
	}[],
): GenerateCanonicalDocsReportItem[] {
	const writtenByDocId = new Map(
		writtenItems.map((w) => [w.documentCanonicalId, w]),
	);
	const renderedByDocId = new Map(
		renderResults.map((r) => [r.documentCanonicalId, r]),
	);

	return planItems.map((pi) => {
		const wi = writtenByDocId.get(pi.documentCanonicalId);
		const rr = renderedByDocId.get(pi.documentCanonicalId);

		const hasMarkdown = rr ? rr.markdown.length > 0 : false;
		const wasRendered = hasMarkdown;

		return {
			action: pi.action,
			checksum: undefined,
			collisionMessage: wi?.collision?.recoveryHint,
			diagnostics: [],
			documentCanonicalId: pi.documentCanonicalId,
			documentId: pi.documentId,
			gaps: pi.gaps.map((g) => g.message),
			manualEditStatus: wi?.manualEditStatus,
			markdownAvailable: hasMarkdown,
			path: pi.documentationRootRelativePath,
			phaseId: pi.phaseId,
			rendered: wasRendered,
			writeStatus: wi?.status ?? ('skipped' as MarkdownWriteStatus),
		};
	});
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

import type { DocumentDescriptorSection } from '../profiles/document-descriptor.js';
import type { DocumentationContract } from '../profiles/documentation-contract.js';
import type { CanonicalMarkdownRenderOptions } from './markdown-renderer-types.js';

type ContractDocEntry = {
	id: string;
	title: string;
	phaseId: string;
	purpose: string;
	centralQuestion: string;
	sections: DocumentDescriptorSection[];
	completionCriteria?: string[];
	qualityChecks?: string[];
	antiPatterns?: string[];
	reviewRules?: string[];
	status: string;
	type: string;
};

function buildContractDocMap(
	contract: DocumentationContract,
): Map<string, ContractDocEntry> {
	const map = new Map<string, ContractDocEntry>();

	for (const d of contract.documents) {
		const entry: ContractDocEntry = {
			centralQuestion: d.descriptor.centralQuestion,
			id: d.descriptor.id,
			phaseId: d.phaseId,
			purpose: d.descriptor.purpose,
			sections: d.descriptor.sections,
			status: d.descriptor.status,
			title: d.descriptor.title,
			type: d.descriptor.type,
		};

		if (d.descriptor.completionCriteria) {
			entry.completionCriteria = d.descriptor.completionCriteria;
		}
		if (d.descriptor.qualityChecks) {
			entry.qualityChecks = d.descriptor.qualityChecks;
		}
		if (d.descriptor.antiPatterns) {
			entry.antiPatterns = d.descriptor.antiPatterns;
		}
		if (d.descriptor.reviewRules) {
			entry.reviewRules = d.descriptor.reviewRules;
		}

		map.set(d.canonicalId, entry);
	}

	return map;
}

function buildRenderOptions(
	options: GenerateCanonicalDocsOptions,
): CanonicalMarkdownRenderOptions {
	const ro: CanonicalMarkdownRenderOptions = {};
	if (options.deterministicTimestamp) {
		ro.generatedAt = options.deterministicTimestamp;
	}
	return ro;
}
