/** Step 10.3 — Agent Pack Generation Service (orchestrator + safe writes) */

import { createHash } from 'node:crypto';
import { statSync } from 'node:fs';
import { resolve as pathResolve } from 'node:path';
import type { SafeWriteChangedPath } from '../fs/safe-filesystem.js';
import { checkPathSafety, writeFileAtomic } from '../fs/safe-filesystem.js';
import type {
	AgentPackGenerationInput,
	AgentPackGenerationItem,
	AgentPackGenerationOptions,
	AgentPackGenerationResult,
	AgentPackGenerationStatus,
	AgentPackRenderDiagnostic,
	AgentPackSecuritySummary,
	AgentPackTemplateKind,
} from './agent-pack-render-types.js';
import { mapPackKindToTemplateKind } from './agent-pack-render-types.js';
import { renderAgentPack } from './agent-pack-renderer.js';
import { checkAgentPackSecurity } from './agent-pack-security.js';
import type { AgentPackPlanItem } from './agent-pack-types.js';
import type { ContextBundle } from './context-bundle-model.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_DOCUMENTATION_ROOT = 'logos';

// ---------------------------------------------------------------------------
// Pack kind ordering for generation
// ---------------------------------------------------------------------------

const PACK_KIND_GEN_ORDER: Record<string, number> = {
	custom: 8,
	documentation: 4,
	executive_task: 7,
	follow_up: 6,
	implementation: 2,
	research: 5,
	review: 1,
	task: 3,
};

// ---------------------------------------------------------------------------
// Main sync generation entry point (plans in memory, no I/O)
// ---------------------------------------------------------------------------

export function generateAgentPacks(
	input: AgentPackGenerationInput,
	options: AgentPackGenerationOptions = {},
): AgentPackGenerationResult {
	const items: AgentPackGenerationItem[] = [];
	const diagnostics: AgentPackRenderDiagnostic[] = [];
	const changedPaths: SafeWriteChangedPath[] = [];
	const dryRun = options.dryRun ?? input.dryRun;
	const writePolicy = options.writePolicy ?? input.writePolicy;
	const allowBlockedBundles =
		options.allowBlockedBundles ?? input.allowBlockedBundles;
	const generatedAt = options.generatedAt ?? input.generatedAt;
	const projectRoot =
		options.projectRoot ?? input.projectRoot ?? pathResolve('.');

	// Sort plan items deterministically
	const sortedPlans = sortPlanItemsForGeneration(input.planItems);

	// Build bundle map
	const bundleMap = new Map<string, ContextBundle>();
	for (const bundle of input.bundles) {
		bundleMap.set(bundle.metadata.packId, bundle);
	}

	for (const planItem of sortedPlans) {
		const bundle = bundleMap.get(planItem.packId);
		const generationItem = processPlanItem(
			planItem,
			bundle,
			input,
			{
				allowBlockedBundles,
				dryRun,
				generatedAt,
				projectRoot,
				writePolicy,
			},
			diagnostics,
			changedPaths,
		);
		items.push(generationItem);
	}

	// Build summary
	return buildResult(
		items,
		input,
		changedPaths,
		diagnostics,
		dryRun,
		generatedAt,
	);
}

// ---------------------------------------------------------------------------
// Async generation entry point (performs actual file writes)
// ---------------------------------------------------------------------------

export async function generateAgentPacksAsync(
	input: AgentPackGenerationInput,
	options: AgentPackGenerationOptions = {},
): Promise<AgentPackGenerationResult> {
	const result = generateAgentPacks(input, options);

	if (result.dryRun) {
		return result;
	}

	const projectRoot =
		options.projectRoot ?? input.projectRoot ?? pathResolve('.');
	const writePolicy =
		options.writePolicy ?? input.writePolicy ?? 'fail_on_collision';
	const createdPaths: string[] = [];
	const updatedPaths: string[] = [];

	for (let i = 0; i < result.items.length; i++) {
		const item = result.items[i];
		if (item === undefined) continue;

		if (
			item.status === 'failed' ||
			item.status === 'blocked' ||
			item.status === 'skipped' ||
			item.status === 'stale'
		) {
			continue;
		}

		if (!item.markdown) continue;

		const outputPath = resolveOutputPath(
			item.relativeOutputPath,
			input.documentationRoot || DEFAULT_DOCUMENTATION_ROOT,
			projectRoot,
		);

		const fileExists = checkFileExists(outputPath);

		if (fileExists && writePolicy === 'skip_existing') {
			continue;
		}

		const backupNeeded = fileExists && writePolicy === 'backup_and_write';

		const writeResult = await writeFileAtomic(outputPath, item.markdown, {
			allowedBaseDir: pathResolve(
				projectRoot,
				input.documentationRoot || DEFAULT_DOCUMENTATION_ROOT,
			),
			backupDir: backupNeeded
				? pathResolve(
						projectRoot,
						input.documentationRoot || DEFAULT_DOCUMENTATION_ROOT,
					)
				: undefined,
			policy: backupNeeded ? 'backup_and_overwrite' : 'overwrite',
		});

		for (const cp of writeResult.changedPaths) {
			result.changedPaths.push(cp);
		}

		if (writeResult.success) {
			if (fileExists) {
				updatedPaths.push(item.relativeOutputPath);
			} else {
				createdPaths.push(item.relativeOutputPath);
			}
		} else {
			item.status = 'failed';
			result.failedPaths.push(item.relativeOutputPath);
		}
	}

	result.createdPaths = createdPaths;
	result.updatedPaths = updatedPaths;
	resetSummaryCounts(result);

	return result;
}

// ---------------------------------------------------------------------------
// Process a single plan item
// ---------------------------------------------------------------------------

function processPlanItem(
	planItem: AgentPackPlanItem,
	bundle: ContextBundle | undefined,
	input: AgentPackGenerationInput,
	options: {
		dryRun: boolean;
		writePolicy: string;
		allowBlockedBundles: boolean;
		generatedAt: string;
		projectRoot: string;
	},
	allDiagnostics: AgentPackRenderDiagnostic[],
	changedPaths: SafeWriteChangedPath[],
): AgentPackGenerationItem {
	const templateKind = mapPackKindToTemplateKind(planItem.packKind);
	const relativeOutputPath = planItem.relativeOutputPath;
	const docRoot = input.documentationRoot || DEFAULT_DOCUMENTATION_ROOT;

	// Check plan item status
	if (planItem.status === 'blocked') {
		return createBlockedItem(planItem, templateKind, 'Plan item is blocked');
	}

	if (planItem.status === 'unknown' || planItem.status === 'missing_source') {
		return createBlockedItem(
			planItem,
			templateKind,
			`Plan item status is ${planItem.status}`,
		);
	}

	if (planItem.status === 'stale') {
		return createStaleItem(planItem, templateKind);
	}

	if (planItem.status === 'requires_review') {
		// Allow rendering with visible markers
	}

	// Bundle check
	if (!bundle) {
		return createBlockedItem(
			planItem,
			templateKind,
			'No bundle available for plan item',
		);
	}

	// Render
	const renderResult = renderAgentPack(
		{
			bundle,
			generatedAt: options.generatedAt,
			packTitle: planItem.title,
			validateCommands: undefined,
		},
		{ allowBlockedBundle: options.allowBlockedBundles },
	);

	allDiagnostics.push(...renderResult.diagnostics);

	if (!renderResult.rendered.markdown) {
		return createFailedItem(
			planItem,
			templateKind,
			'Rendering produced empty Markdown',
			bundle.metadata.bundleId,
			renderResult.rendered.securitySummary,
		);
	}

	// Security check
	const securityResult = checkAgentPackSecurity({
		markdown: renderResult.rendered.markdown,
		metadata: {
			artifactType: 'agent_pack',
			canonical: false,
		},
		outputPath: relativeOutputPath,
		sourcePaths: planItem.canonicalSourceOutputPaths,
	});

	allDiagnostics.push(...securityResult.diagnostics);

	if (!securityResult.passed) {
		return createFailedItem(
			planItem,
			templateKind,
			`Security check failed: ${securityResult.securitySummary.blockReasons.join(', ')}`,
			bundle.metadata.bundleId,
			securityResult.securitySummary,
		);
	}

	// Compute checksum
	const checksum = createHash('sha256')
		.update(renderResult.rendered.markdown, 'utf-8')
		.digest('hex');

	// Determine output path
	const outputPath = resolveOutputPath(
		relativeOutputPath,
		docRoot,
		options.projectRoot,
	);

	// Check if output path is safe
	const pathSafety = checkPathSafety(outputPath, {
		allowedBaseDir: pathResolve(options.projectRoot, docRoot),
	});

	if (!pathSafety.safe) {
		return createFailedItem(
			planItem,
			templateKind,
			`Output path is unsafe: ${pathSafety.diagnostics.map((d) => d.message).join('; ')}`,
			bundle.metadata.bundleId,
			securityResult.securitySummary,
		);
	}

	// Dry-run
	if (options.dryRun) {
		changedPaths.push({ path: outputPath, role: 'planned' });
		return createDryRunSuccessItem(
			planItem,
			templateKind,
			bundle.metadata.bundleId,
			checksum,
			renderResult.rendered.markdown,
			outputPath,
			relativeOutputPath,
			securityResult.securitySummary,
		);
	}

	// Check if file exists
	const fileExists = checkFileExists(outputPath);

	// Determine write action based on policy
	if (fileExists && options.writePolicy === 'skip_existing') {
		changedPaths.push({ path: outputPath, role: 'skipped' });
		return createSkippedItem(
			planItem,
			templateKind,
			bundle.metadata.bundleId,
			checksum,
			renderResult.rendered.markdown,
			outputPath,
			relativeOutputPath,
			securityResult.securitySummary,
		);
	}

	if (fileExists && options.writePolicy === 'fail_on_collision') {
		return createFailedItem(
			planItem,
			templateKind,
			'File exists and write policy is fail_on_collision',
			bundle.metadata.bundleId,
			securityResult.securitySummary,
		);
	}

	// Will be written (or backup-then-written)
	changedPaths.push({
		path: outputPath,
		role: fileExists ? 'file_updated' : 'file_created',
	});

	return {
		blockers: [],
		bundleId: bundle.metadata.bundleId,
		checksum,
		diagnostics: [],
		markdown: renderResult.rendered.markdown,
		outputPath,
		packId: planItem.packId,
		packKind: planItem.packKind,
		reasons: [],
		relativeOutputPath,
		securitySummary: securityResult.securitySummary,
		sourceCanonicalPaths: planItem.canonicalSourceOutputPaths,
		sourceDocumentIds: planItem.canonicalSourceDocumentIds,
		status: fileExists ? 'updated' : 'created',
		templateKind,
	};
}

// ---------------------------------------------------------------------------
// Result builder
// ---------------------------------------------------------------------------

function buildResult(
	items: AgentPackGenerationItem[],
	input: AgentPackGenerationInput,
	changedPaths: SafeWriteChangedPath[],
	diagnostics: AgentPackRenderDiagnostic[],
	dryRun: boolean,
	generatedAt: string,
): AgentPackGenerationResult {
	const summaryCounts: Record<AgentPackGenerationStatus, number> = {
		blocked: 0,
		created: 0,
		failed: 0,
		requires_review: 0,
		skipped: 0,
		stale: 0,
		updated: 0,
	};

	const summaryByKind: Record<AgentPackTemplateKind, number> = {
		coding_agent: 0,
		custom: 0,
		documentation_agent: 0,
		executive_task_agent: 0,
		follow_up_agent: 0,
		research_agent: 0,
		review_agent: 0,
		task_agent: 0,
	};

	const createdPaths: string[] = [];
	const updatedPaths: string[] = [];
	const skippedPaths: string[] = [];
	const blockedPaths: string[] = [];
	const failedPaths: string[] = [];

	for (const item of items) {
		summaryCounts[item.status] = (summaryCounts[item.status] ?? 0) + 1;
		summaryByKind[item.templateKind] =
			(summaryByKind[item.templateKind] ?? 0) + 1;

		switch (item.status) {
			case 'created':
				if (!dryRun) createdPaths.push(item.relativeOutputPath);
				break;
			case 'updated':
				if (!dryRun) updatedPaths.push(item.relativeOutputPath);
				break;
			case 'skipped':
				skippedPaths.push(item.relativeOutputPath);
				break;
			case 'blocked':
			case 'stale':
				blockedPaths.push(item.relativeOutputPath);
				break;
			case 'failed':
				failedPaths.push(item.relativeOutputPath);
				break;
		}
	}

	const securitySummary = aggregateSecuritySummary(items);

	return {
		artifactRegistryEntriesCreated: 0,
		artifactRegistryEntriesUpdated: 0,
		artifactRoot: input.artifactRoot,
		blockedPaths,
		changedPaths,
		createdPaths,
		diagnostics,
		documentationRoot: input.documentationRoot || DEFAULT_DOCUMENTATION_ROOT,
		dryRun,
		failedPaths,
		generatedAt,
		items,
		profileId: input.profileId,
		readOnly: dryRun,
		securitySummary,
		skippedPaths,
		summaryByKind,
		summaryCounts,
		updatedPaths,
	};
}

// ---------------------------------------------------------------------------
// Item factories
// ---------------------------------------------------------------------------

function createBlockedItem(
	planItem: AgentPackPlanItem,
	templateKind: AgentPackTemplateKind,
	reason: string,
): AgentPackGenerationItem {
	return {
		blockers: [reason],
		bundleId: '',
		checksum: undefined,
		diagnostics: [
			{
				code: 'I_AP_GEN_BLOCKED',
				expected: undefined,
				fieldPath: undefined,
				message: reason,
				outputPath: planItem.relativeOutputPath,
				received: undefined,
				recoveryHint: 'Resolve blockers in the plan item before generation.',
				relatedBundleId: undefined,
				relatedPackId: planItem.packId,
				relatedPackKind: planItem.packKind,
				relatedPhaseId: undefined,
				relatedRegisterItemId: undefined,
				relatedSourceDocumentId: undefined,
				relatedTemplateKind: templateKind,
				severity: 'warning',
				sourcePath: undefined,
			},
		],
		markdown: undefined,
		outputPath: planItem.relativeOutputPath,
		packId: planItem.packId,
		packKind: planItem.packKind,
		reasons: [reason],
		relativeOutputPath: planItem.relativeOutputPath,
		securitySummary: emptySecuritySummary(),
		sourceCanonicalPaths: planItem.canonicalSourceOutputPaths,
		sourceDocumentIds: planItem.canonicalSourceDocumentIds,
		status: 'blocked',
		templateKind,
	};
}

function createStaleItem(
	planItem: AgentPackPlanItem,
	templateKind: AgentPackTemplateKind,
): AgentPackGenerationItem {
	return {
		blockers: ['Source documents are stale'],
		bundleId: '',
		checksum: undefined,
		diagnostics: [
			{
				code: 'I_AP_GEN_STALE',
				expected: undefined,
				fieldPath: undefined,
				message: 'Plan item sources are stale',
				outputPath: planItem.relativeOutputPath,
				received: undefined,
				recoveryHint:
					'Regenerate canonical documents first to refresh sources.',
				relatedBundleId: undefined,
				relatedPackId: planItem.packId,
				relatedPackKind: planItem.packKind,
				relatedPhaseId: undefined,
				relatedRegisterItemId: undefined,
				relatedSourceDocumentId: undefined,
				relatedTemplateKind: templateKind,
				severity: 'warning',
				sourcePath: undefined,
			},
		],
		markdown: undefined,
		outputPath: planItem.relativeOutputPath,
		packId: planItem.packId,
		packKind: planItem.packKind,
		reasons: ['Sources are stale'],
		relativeOutputPath: planItem.relativeOutputPath,
		securitySummary: emptySecuritySummary(),
		sourceCanonicalPaths: planItem.canonicalSourceOutputPaths,
		sourceDocumentIds: planItem.canonicalSourceDocumentIds,
		status: 'stale',
		templateKind,
	};
}

function createFailedItem(
	planItem: AgentPackPlanItem,
	templateKind: AgentPackTemplateKind,
	reason: string,
	bundleId: string,
	securitySummary: AgentPackSecuritySummary | undefined,
): AgentPackGenerationItem {
	return {
		blockers: [reason],
		bundleId,
		checksum: undefined,
		diagnostics: [
			{
				code: 'E_AP_GEN_FAILED',
				expected: undefined,
				fieldPath: undefined,
				message: reason,
				outputPath: planItem.relativeOutputPath,
				received: undefined,
				recoveryHint: undefined,
				relatedBundleId: bundleId,
				relatedPackId: planItem.packId,
				relatedPackKind: planItem.packKind,
				relatedPhaseId: undefined,
				relatedRegisterItemId: undefined,
				relatedSourceDocumentId: undefined,
				relatedTemplateKind: templateKind,
				severity: 'error',
				sourcePath: undefined,
			},
		],
		markdown: undefined,
		outputPath: planItem.relativeOutputPath,
		packId: planItem.packId,
		packKind: planItem.packKind,
		reasons: [reason],
		relativeOutputPath: planItem.relativeOutputPath,
		securitySummary:
			securitySummary ??
			({
				blockReasons: [reason],
				forbiddenModelResponseCount: 0,
				forbiddenRawPromptCount: 0,
				passed: false,
				redactionCount: 0,
				tokenLikeValueCount: 0,
			} satisfies AgentPackSecuritySummary),
		sourceCanonicalPaths: planItem.canonicalSourceOutputPaths,
		sourceDocumentIds: planItem.canonicalSourceDocumentIds,
		status: 'failed',
		templateKind,
	};
}

function createSkippedItem(
	planItem: AgentPackPlanItem,
	templateKind: AgentPackTemplateKind,
	bundleId: string,
	checksum: string | undefined,
	markdown: string | undefined,
	outputPath: string,
	relativeOutputPath: string,
	securitySummary: AgentPackSecuritySummary,
): AgentPackGenerationItem {
	return {
		blockers: [],
		bundleId,
		checksum,
		diagnostics: [
			{
				code: 'I_AP_GEN_SKIPPED',
				expected: undefined,
				fieldPath: undefined,
				message: 'File exists and write policy is skip_existing',
				outputPath,
				received: undefined,
				recoveryHint: 'Use explicit_overwrite policy to replace existing file.',
				relatedBundleId: bundleId,
				relatedPackId: planItem.packId,
				relatedPackKind: planItem.packKind,
				relatedPhaseId: undefined,
				relatedRegisterItemId: undefined,
				relatedSourceDocumentId: undefined,
				relatedTemplateKind: templateKind,
				severity: 'info',
				sourcePath: undefined,
			},
		],
		markdown,
		outputPath,
		packId: planItem.packId,
		packKind: planItem.packKind,
		reasons: ['File exists'],
		relativeOutputPath,
		securitySummary,
		sourceCanonicalPaths: planItem.canonicalSourceOutputPaths,
		sourceDocumentIds: planItem.canonicalSourceDocumentIds,
		status: 'skipped',
		templateKind,
	};
}

function createDryRunSuccessItem(
	planItem: AgentPackPlanItem,
	templateKind: AgentPackTemplateKind,
	bundleId: string,
	checksum: string | undefined,
	markdown: string | undefined,
	outputPath: string,
	relativeOutputPath: string,
	securitySummary: AgentPackSecuritySummary,
): AgentPackGenerationItem {
	return {
		blockers: [],
		bundleId,
		checksum,
		diagnostics: [],
		markdown,
		outputPath,
		packId: planItem.packId,
		packKind: planItem.packKind,
		reasons: [],
		relativeOutputPath,
		securitySummary,
		sourceCanonicalPaths: planItem.canonicalSourceOutputPaths,
		sourceDocumentIds: planItem.canonicalSourceDocumentIds,
		status: 'created',
		templateKind,
	};
}

function emptySecuritySummary(): AgentPackSecuritySummary {
	return {
		blockReasons: [],
		forbiddenModelResponseCount: 0,
		forbiddenRawPromptCount: 0,
		passed: true,
		redactionCount: 0,
		tokenLikeValueCount: 0,
	};
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function sortPlanItemsForGeneration(
	items: AgentPackPlanItem[],
): AgentPackPlanItem[] {
	return [...items].sort((a, b) => {
		const phaseA = a.phaseId ?? '';
		const phaseB = b.phaseId ?? '';
		if (phaseA !== phaseB) return phaseA.localeCompare(phaseB);

		const poA = PACK_KIND_GEN_ORDER[a.packKind] ?? 99;
		const poB = PACK_KIND_GEN_ORDER[b.packKind] ?? 99;
		if (poA !== poB) return poA - poB;

		return (a.orderIndex ?? 0) - (b.orderIndex ?? 0);
	});
}

export function resolveOutputPath(
	relativePath: string,
	docRoot: string,
	projectRoot: string,
): string {
	const normalizedRoot = docRoot
		.replace(/\\/g, '/')
		.replace(/^\.\/+|\/+$/g, '');
	const normalizedPath = relativePath
		.replace(/\\/g, '/')
		.replace(/^\.\/+/, '')
		.replace(/^\/+/, '');
	const fullRel =
		normalizedPath === normalizedRoot ||
		normalizedPath.startsWith(`${normalizedRoot}/`)
			? normalizedPath
			: `${normalizedRoot}/${normalizedPath}`;
	return pathResolve(projectRoot, fullRel);
}

export function checkFileExists(path: string): boolean {
	try {
		const s = statSync(path);
		return s.isFile();
	} catch {
		return false;
	}
}

function aggregateSecuritySummary(
	items: AgentPackGenerationItem[],
): AgentPackSecuritySummary {
	const summary: AgentPackSecuritySummary = {
		blockReasons: [],
		forbiddenModelResponseCount: 0,
		forbiddenRawPromptCount: 0,
		passed: true,
		redactionCount: 0,
		tokenLikeValueCount: 0,
	};

	for (const item of items) {
		if (!item.securitySummary) continue;
		summary.forbiddenModelResponseCount +=
			item.securitySummary.forbiddenModelResponseCount;
		summary.forbiddenRawPromptCount +=
			item.securitySummary.forbiddenRawPromptCount;
		summary.redactionCount += item.securitySummary.redactionCount;
		summary.tokenLikeValueCount += item.securitySummary.tokenLikeValueCount;
		summary.blockReasons.push(...item.securitySummary.blockReasons);
		if (!item.securitySummary.passed) {
			summary.passed = false;
		}
	}

	return summary;
}

function resetSummaryCounts(result: AgentPackGenerationResult): void {
	const summaryCounts: Record<AgentPackGenerationStatus, number> = {
		blocked: 0,
		created: 0,
		failed: 0,
		requires_review: 0,
		skipped: 0,
		stale: 0,
		updated: 0,
	};

	for (const item of result.items) {
		summaryCounts[item.status] = (summaryCounts[item.status] ?? 0) + 1;
	}

	result.summaryCounts = summaryCounts;
}

// ---------------------------------------------------------------------------
// Artifact registry integration
// ---------------------------------------------------------------------------

/**
 * Build artifact registry entries from generation items.
 * Entries are non-canonical and marked as derived execution aids.
 */
export function buildAgentPackArtifactRecords(
	items: AgentPackGenerationItem[],
	idFactory: () => string,
): {
	artifactId: string;
	artifactType: 'agent_pack';
	path: string;
	status: string;
	checksum: string | undefined;
	isCanonical: false;
	sourceDocumentIds: string[];
	metadata: Record<string, unknown>;
}[] {
	const records: Array<{
		artifactId: string;
		artifactType: 'agent_pack';
		path: string;
		status: string;
		checksum: string | undefined;
		isCanonical: false;
		sourceDocumentIds: string[];
		metadata: Record<string, unknown>;
	}> = [];

	for (const item of items) {
		if (item.status !== 'created' && item.status !== 'updated') continue;

		records.push({
			artifactId: idFactory(),
			artifactType: 'agent_pack',
			checksum: item.checksum,
			isCanonical: false,
			metadata: {
				bundleId: item.bundleId,
				isDerivedExecutionAid: true,
				packKind: item.packKind,
				sourceCanonicalPaths: item.sourceCanonicalPaths,
				templateKind: item.templateKind,
			},
			path: item.relativeOutputPath,
			sourceDocumentIds: item.sourceDocumentIds,
			status: item.status === 'created' ? 'generated' : 'updated',
		});
	}

	return records;
}
