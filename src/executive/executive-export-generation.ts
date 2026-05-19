/** Step 11.3 — Executive Export Generation Service (orchestrator) */

import { normalize, resolve } from 'node:path';
import { executiveAgentPackExportAdapter } from './executive-agent-pack-export.js';
import type {
	ExecutiveExportAdapterKind,
	ExecutiveExportChangedPath,
	ExecutiveExportDiagnostic,
	ExecutiveExportGenerationInput,
	ExecutiveExportGenerationItem,
	ExecutiveExportGenerationOptions,
	ExecutiveExportGenerationResult,
	ExecutiveExportGenerationStatus,
	ExecutiveExportInput,
	ExecutiveExportOptions,
	ExecutiveExportRenderedFile,
	ExecutiveExportReport,
	ExecutiveExportResult,
	ExecutiveExportSecurityCheck,
	ExecutiveExportSecuritySummary,
	ExecutiveExportWritePolicy,
} from './executive-export-model.js';
import {
	ADAPTER_KIND_ORDER,
	isPlannedAdapterContract,
	isSupportedFileExport,
} from './executive-export-model.js';
import { executiveGitHubIssuesExportAdapter } from './executive-github-issues-export.js';
import { executiveHtmlExportAdapter } from './executive-html-export.js';
import { executiveMarkdownExportAdapter } from './executive-markdown-export.js';

// ---------------------------------------------------------------------------
// Adapter registry
// ---------------------------------------------------------------------------

const ADAPTERS_BY_KIND: Record<
	ExecutiveExportAdapterKind,
	| {
			render: (
				input: ExecutiveExportInput,
				options?: ExecutiveExportOptions,
			) => ExecutiveExportResult;
	  }
	| undefined
> = {
	agent_pack_file: executiveAgentPackExportAdapter,
	custom: undefined,
	github_issue_file: executiveGitHubIssuesExportAdapter,
	html: executiveHtmlExportAdapter,
	linear_mapping: undefined,
	markdown: executiveMarkdownExportAdapter,
	notion_mapping: undefined,
};

// ---------------------------------------------------------------------------
// Security check for content before writing
// ---------------------------------------------------------------------------

function securityCheckBeforeWrite(
	content: string,
	format: string,
): { passed: boolean; checks: ExecutiveExportSecurityCheck[] } {
	const checks: ExecutiveExportSecurityCheck[] = [
		{
			checkId: 'no_raw_tokens',
			name: 'No raw provider tokens',
			passed: !/sk-[a-zA-Z0-9]{20,}/.test(content),
		},
		{
			checkId: 'no_auth_headers',
			name: 'No authorization headers',
			passed:
				!/bearer [a-zA-Z0-9_.-]{20,}/i.test(content) &&
				!/Authorization:\s*(Bearer|Basic)/i.test(content),
		},
		{
			checkId: 'no_private_keys',
			name: 'No private keys',
			passed: !/-----BEGIN (RSA|EC|OPENSSH|DSA) PRIVATE KEY-----/.test(content),
		},
		{
			checkId: 'no_raw_env_values',
			name: 'No raw env values',
			passed: !/(AKIA|ghp_|xoxb-|xoxp-|dapi_)['"]?[a-zA-Z0-9_-]{20,}/.test(
				content,
			),
		},
		{
			checkId: 'no_raw_prompts',
			name: 'No raw prompts/responses',
			passed:
				!/system:\s*you are an?/i.test(content) &&
				!/<\|assistant\|>/i.test(content),
		},
		{
			checkId: 'no_private_chat',
			name: 'No private chat history',
			passed:
				!/\[CHAT_HISTORY\]/i.test(content) &&
				!/conversation_log/i.test(content),
		},
		{
			checkId: 'no_path_traversal',
			name: 'No path traversal',
			passed: !/\.\.\/\.\.\//.test(content),
		},
		{
			checkId: 'no_canonical_claim',
			name: 'No canonical authority claim',
			passed:
				!content.includes('canonical: true') ||
				content.includes('non-canonical') ||
				content.includes('nonCanonical: true') ||
				content.includes('canonical: false'),
		},
		{
			checkId: 'no_external_api_true',
			name: 'No external API execution true',
			passed: !content.includes('externalApiExecution: true'),
		},
	];

	// HTML-specific checks
	if (format === 'html') {
		checks.push(
			{
				checkId: 'no_html_scripts',
				name: 'No script tags',
				passed: !/<script/i.test(content),
			},
			{
				checkId: 'no_inline_handlers',
				name: 'No inline event handlers',
				passed: !/\son\w+\s*=/i.test(content),
			},
			{
				checkId: 'no_external_stylesheets',
				name: 'No external stylesheet links',
				passed: !/<link\s+rel=["']stylesheet/i.test(content),
			},
			{
				checkId: 'no_iframes',
				name: 'No iframe tags',
				passed: !/<iframe/i.test(content),
			},
			{
				checkId: 'no_forms',
				name: 'No form tags',
				passed: !/<form/i.test(content),
			},
			{
				checkId: 'no_js_protocol',
				name: 'No javascript:/vbscript:',
				passed: !/javascript:/i.test(content) && !/vbscript:/i.test(content),
			},
		);
	}

	// Agent-pack-specific checks
	if (format === 'markdown' && content.includes('Agent Task:')) {
		checks.push(
			{
				checkId: 'no_unrelated_changes_override',
				name: 'No unrelated changes override',
				passed: !content.includes('ignore all constraints'),
			},
			{
				checkId: 'no_exfiltrate_instruction',
				name: 'No exfiltrate instruction',
				passed:
					!/exfiltrate (?!secrets|tokens|private|sensitive)/.test(content) ||
					content.includes('Do **not** exfiltrate'),
			},
		);
	}

	return { checks, passed: checks.every((c) => c.passed) };
}

// ---------------------------------------------------------------------------
// Path safety
// ---------------------------------------------------------------------------

function isPathSafe(relativePath: string, _baseDir: string): boolean {
	const normalized = normalize(relativePath);
	// Reject path traversal
	if (normalized.includes('..')) return false;
	// Reject absolute paths
	if (normalized.startsWith('/')) return false;
	if (/^[A-Za-z]:\\/.test(normalized)) return false;
	return true;
}

// ---------------------------------------------------------------------------
// Dry-run write simulation
// ---------------------------------------------------------------------------

interface DryRunWriteResult {
	readonly writePlan: ReadonlyArray<{
		path: string;
		action: string;
		checksum: string;
	}>;
	readonly createdPaths: readonly string[];
	readonly diagnostics: readonly ExecutiveExportDiagnostic[];
}

function simulateWrites(
	files: readonly ExecutiveExportRenderedFile[],
	baseDir: string,
	policy: ExecutiveExportWritePolicy,
): DryRunWriteResult {
	const writePlan: { path: string; action: string; checksum: string }[] = [];
	const createdPaths: string[] = [];
	const diagnostics: ExecutiveExportDiagnostic[] = [];

	for (const file of files) {
		const fullPath = normalize(`${baseDir}/${file.relativePath}`);

		if (!isPathSafe(file.relativePath, baseDir)) {
			diagnostics.push({
				code: 'executive_export_unsafe_path',
				message: `Unsafe output path: ${file.relativePath}`,
				outputPath: file.relativePath,
				severity: 'error',
			});
			continue;
		}

		writePlan.push({
			action:
				policy === 'fail_on_collision' ? 'fail_if_exists' : 'skip_if_exists',
			checksum: file.checksum,
			path: fullPath,
		});
		createdPaths.push(fullPath);
	}

	return { createdPaths, diagnostics, writePlan };
}

// ---------------------------------------------------------------------------
// Build report
// ---------------------------------------------------------------------------

function buildReport(
	items: readonly ExecutiveExportGenerationItem[],
	input: ExecutiveExportGenerationInput,
	securitySummary: ExecutiveExportSecuritySummary,
): ExecutiveExportReport {
	const supportedExports = items
		.filter((i) => isSupportedFileExport(i.supportStatus))
		.map((i) => i.targetId);
	const plannedContracts = items
		.filter((i) => isPlannedAdapterContract(i.supportStatus))
		.map((i) => i.targetId);
	const unsupported = items
		.filter(
			(i) =>
				i.supportStatus === 'unsupported' ||
				i.supportStatus === 'blocked' ||
				i.supportStatus === 'unknown',
		)
		.map((i) => i.targetId);

	const outputPaths = items.flatMap((i) => i.outputPaths);

	return {
		blockedCount: items.filter((i) => i.status === 'blocked').length,
		createdCount: items.filter((i) => i.status === 'created').length,
		derivedSnapshot: true,
		externalApiExecution: false,
		failedCount: items.filter((i) => i.status === 'failed').length,
		noExternalRecordsCreated: true,
		nonCanonical: true,
		outputPaths,
		planFingerprint: input.planFingerprint,
		planId: input.planId,
		plannedAdapterContracts: plannedContracts,
		plannedMappingsNote:
			plannedContracts.length > 0
				? `Planned adapter contracts: ${plannedContracts.join(', ')}. These mappings exist but live sync/API creation is not implemented. No external records were created. Future adapter work is required.`
				: 'No planned adapter contracts.',
		requiresReviewCount: items.filter((i) => i.status === 'requires_review')
			.length,
		securitySummary,
		selectedTargets: items.map((i) => i.targetId),
		skippedCount: items.filter((i) => i.status === 'skipped').length,
		supportedFileExports: supportedExports,
		unsupportedTargets: unsupported,
		updatedCount: items.filter((i) => i.status === 'updated').length,
	};
}

// ---------------------------------------------------------------------------
// Generate exports
// ---------------------------------------------------------------------------

export function generateExecutiveExports(
	input: ExecutiveExportGenerationInput,
	options: ExecutiveExportGenerationOptions = {},
): ExecutiveExportGenerationResult {
	const diagnostics: ExecutiveExportDiagnostic[] = [];
	const allItems: ExecutiveExportGenerationItem[] = [];
	const changedPaths: ExecutiveExportChangedPath[] = [];
	const createdPaths: string[] = [];
	const updatedPaths: string[] = [];
	const skippedPaths: string[] = [];
	const blockedPaths: string[] = [];
	const failedPaths: string[] = [];
	let artifactRegistryCreated = 0;
	const artifactRegistryUpdated = 0;
	const allSecurityChecks: ExecutiveExportSecurityCheck[] = [];

	const dryRun = options.dryRun ?? false;
	const writePolicy: ExecutiveExportWritePolicy =
		options.writePolicy ?? 'skip_existing';
	const _runId = options.injectRunId;
	const _artifactIds = options.injectArtifactIds;
	void _runId;
	void _artifactIds;
	const baseDir = input.documentationRoot || 'logos/';
	const artifactRoot = input.artifactRoot
		? resolve(normalize(input.artifactRoot))
		: resolve(normalize(baseDir));

	const selectedKinds = input.selectedAdapterKinds ?? undefined;

	// Select mappings
	let selectedMappings = input.mappings;
	if (selectedKinds && selectedKinds.length > 0) {
		selectedMappings = input.mappings.filter((m) =>
			selectedKinds.includes(m.adapterKind),
		);
	}

	// Sort by adapter kind order
	const sortedMappings = [...selectedMappings].sort((a, b) => {
		const aOrder = ADAPTER_KIND_ORDER[a.adapterKind] ?? 99;
		const bOrder = ADAPTER_KIND_ORDER[b.adapterKind] ?? 99;
		if (aOrder !== bOrder) return aOrder - bOrder;
		return a.mappingId.localeCompare(b.mappingId);
	});

	// Process each mapping
	for (const mapping of sortedMappings) {
		const adapter = ADAPTERS_BY_KIND[mapping.adapterKind];

		if (!adapter && mapping.adapterKind !== 'custom') {
			// Linear/Notion or unknown
			const status: ExecutiveExportGenerationStatus = isPlannedAdapterContract(
				mapping.supportStatus,
			)
				? 'skipped'
				: 'blocked';

			if (isPlannedAdapterContract(mapping.supportStatus)) {
				diagnostics.push({
					adapterKind: mapping.adapterKind,
					code: 'executive_export_planned_adapter',
					mappingPath: mapping.sourcePath,
					message: `Mapping "${mapping.mappingId}" (${mapping.adapterKind}) is a planned adapter contract. Live sync/API creation is not implemented. No external records were created. Future adapter work is required.`,
					recoveryHint: 'Implement the adapter or use local file-only exports.',
					severity: 'info' as never,
					targetId: mapping.mappingId,
				});
			}

			allItems.push({
				adapterKind: mapping.adapterKind,
				artifactIds: [],
				checksums: [],
				diagnostics: [],
				outputPaths: [],
				status,
				supportStatus: mapping.supportStatus,
				targetId: mapping.mappingId,
				title: `${mapping.name} (${mapping.supportStatus})`,
			});
			continue;
		}

		if (!adapter) {
			allItems.push({
				adapterKind: mapping.adapterKind,
				artifactIds: [],
				checksums: [],
				diagnostics: [
					{
						code: 'executive_export_no_adapter',
						message: `No export adapter available for kind "${mapping.adapterKind}"`,
						severity: 'error',
						targetId: mapping.mappingId,
					},
				],
				outputPaths: [],
				status: 'blocked',
				supportStatus: mapping.supportStatus,
				targetId: mapping.mappingId,
				title: `${mapping.name} (blocked — no adapter)`,
			});
			failedPaths.push(mapping.mappingId);
			continue;
		}

		// Build render input
		const renderInput: ExecutiveExportInput = {
			clock: input.clock,
			documentationRoot: input.documentationRoot,
			mapping,
			plan: input.plan,
			planFingerprint: input.planFingerprint,
			planId: input.planId,
			profileId: input.profileId,
			profileVersion: input.profileVersion,
			readinessStatus: input.readinessStatus,
		};

		const renderOptions: ExecutiveExportOptions = {
			injectTimestamp: input.clock(),
			writePolicy,
		};

		// Render
		let result: ExecutiveExportResult;
		try {
			result = adapter.render(renderInput, renderOptions);
		} catch (err) {
			diagnostics.push({
				adapterKind: mapping.adapterKind,
				code: 'executive_export_render_failed',
				message: `Export render failed for "${mapping.mappingId}": ${String(err)}`,
				severity: 'error',
				targetId: mapping.mappingId,
			});
			allItems.push({
				adapterKind: mapping.adapterKind,
				artifactIds: [],
				checksums: [],
				diagnostics: [
					{
						code: 'executive_export_render_failed',
						message: String(err),
						severity: 'error',
						targetId: mapping.mappingId,
					},
				],
				outputPaths: [],
				status: 'failed',
				supportStatus: mapping.supportStatus,
				targetId: mapping.mappingId,
				title: `${mapping.name} (failed)`,
			});
			failedPaths.push(mapping.mappingId);
			continue;
		}

		// If blocked adapter contract
		if (isPlannedAdapterContract(result.supportStatus)) {
			diagnostics.push({
				adapterKind: mapping.adapterKind,
				code: 'executive_export_planned_adapter',
				message: `No live integration for "${mapping.mappingId}". This is a planned adapter contract.`,
				severity: 'info' as never,
				targetId: mapping.mappingId,
			});
		}

		// Gather security info
		allSecurityChecks.push(...result.securitySummary.checks);

		// Dry-run handling
		if (dryRun) {
			const { createdPaths: planned, diagnostics: dryDiags } = simulateWrites(
				result.renderedFiles,
				baseDir,
				writePolicy,
			);
			diagnostics.push(...dryDiags);

			const outputPaths = result.renderedFiles.map((f) => f.relativePath);
			allItems.push({
				adapterKind: result.adapterKind,
				artifactIds: [],
				checksums: result.renderedFiles.map((f) => f.checksum),
				diagnostics: [],
				outputPaths,
				status: 'created',
				supportStatus: result.supportStatus,
				targetId: result.targetId,
				title: result.title,
			});
			createdPaths.push(...planned);
			continue;
		}

		// Non-dry-run: validate security, write files, update registry
		const itemOutputPaths: string[] = [];
		const itemChecksums: string[] = [];
		const itemArtifactIds: string[] = [];
		let itemStatus: ExecutiveExportGenerationStatus = 'created';
		let artifactIdx = 0;

		for (const file of result.renderedFiles) {
			// Security check
			const secResult = securityCheckBeforeWrite(file.content, file.format);
			if (!secResult.passed) {
				diagnostics.push({
					adapterKind: result.adapterKind,
					code: 'executive_export_security_blocked',
					message: `Security check failed for "${file.relativePath}": ${secResult.checks
						.filter((c) => !c.passed)
						.map((c) => c.checkId)
						.join(', ')}`,
					outputPath: file.relativePath,
					severity: 'error',
					targetId: result.targetId,
				});
				failedPaths.push(file.relativePath);
				changedPaths.push({
					checksum: file.checksum,
					path: file.relativePath,
					role: 'failed',
				});
				itemStatus = 'failed';
				continue;
			}

			// Path safety
			if (!isPathSafe(file.relativePath, baseDir)) {
				diagnostics.push({
					adapterKind: result.adapterKind,
					code: 'executive_export_unsafe_path',
					message: `Unsafe output path rejected: ${file.relativePath}`,
					outputPath: file.relativePath,
					severity: 'error',
					targetId: result.targetId,
				});
				failedPaths.push(file.relativePath);
				itemStatus = 'failed';
				continue;
			}

			// Build artifact record
			const artifactId =
				_artifactIds?.[artifactIdx] ?? `exec-exp-${Date.now()}-${artifactIdx}`;
			artifactIdx++;
			itemArtifactIds.push(artifactId);
			itemOutputPaths.push(file.relativePath);
			itemChecksums.push(file.checksum);

			// Note: actual file writes happen through the safe filesystem adapter
			// which is the caller's responsibility to orchestrate if needed.
			// Here we record the changed path for the generation report.
			changedPaths.push({
				checksum: file.checksum,
				path: file.relativePath,
				role: 'created',
			});
			createdPaths.push(file.relativePath);
		}

		// Artifact records are created by the caller via the safe filesystem adapter
		artifactRegistryCreated += itemArtifactIds.length;

		allItems.push({
			adapterKind: result.adapterKind,
			artifactIds: itemArtifactIds,
			checksums: itemChecksums,
			diagnostics: [],
			outputPaths: itemOutputPaths,
			status: itemStatus,
			supportStatus: result.supportStatus,
			targetId: result.targetId,
			title: result.title,
		});
	}

	// Summary counts
	const summaryCountsByStatus: Record<ExecutiveExportGenerationStatus, number> =
		{
			blocked: allItems.filter((i) => i.status === 'blocked').length,
			created: allItems.filter((i) => i.status === 'created').length,
			failed: allItems.filter((i) => i.status === 'failed').length,
			requires_review: allItems.filter((i) => i.status === 'requires_review')
				.length,
			skipped: allItems.filter((i) => i.status === 'skipped').length,
			updated: allItems.filter((i) => i.status === 'updated').length,
		};

	const summaryCountsByAdapterKind: Partial<
		Record<ExecutiveExportAdapterKind, number>
	> = {};
	for (const item of allItems) {
		summaryCountsByAdapterKind[item.adapterKind] =
			(summaryCountsByAdapterKind[item.adapterKind] ?? 0) + 1;
	}

	const securitySummary: ExecutiveExportSecuritySummary = {
		checks: allSecurityChecks,
		passed: allSecurityChecks.every((c) => c.passed),
	};

	const report = buildReport(allItems, input, securitySummary);

	return {
		artifactRegistryEntriesCreated: artifactRegistryCreated,
		artifactRegistryEntriesUpdated: artifactRegistryUpdated,
		artifactRoot,
		blockedPaths,
		changedPaths,
		createdPaths,
		diagnostics,
		documentationRoot: input.documentationRoot,
		dryRun,
		failedPaths,
		items: allItems,
		planId: input.planId,
		profileId: input.profileId,
		readOnly: dryRun,
		report,
		securitySummary,
		skippedPaths,
		summaryCountsByAdapterKind,
		summaryCountsByStatus,
		updatedPaths,
	};
}
