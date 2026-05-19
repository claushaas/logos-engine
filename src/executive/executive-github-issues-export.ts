/** Step 11.3 — Executive GitHub Issue-Compatibile File Export Adapter */

import { createHash } from 'node:crypto';
import type {
	ExecutiveExportAdapter,
	ExecutiveExportDiagnostic,
	ExecutiveExportInput,
	ExecutiveExportOptions,
	ExecutiveExportResult,
	ExecutiveExportResultMetadata,
	ExecutiveExportSecurityCheck,
	ExecutiveExportSecuritySummary,
} from './executive-export-model.js';
import type {
	ExecutivePlanJson,
	ExecutivePlanJsonItem,
} from './executive-plan-model.js';

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export const executiveGitHubIssuesExportAdapter: ExecutiveExportAdapter = {
	kind: 'github_issue_file',
	render,
	supportStatus: 'supported_file_export',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function escapeMdInline(s: string): string {
	return s.replace(/[\\`*_{}[\]()#+\-.!|<>]/g, '\\$&');
}

function itemToTypeLabel(type: string): string {
	switch (type) {
		case 'task':
			return 'task';
		case 'bug':
			return 'bug';
		case 'risk':
			return 'risk';
		case 'review':
			return 'review';
		case 'decision':
			return 'decision';
		case 'question':
			return 'question';
		case 'blocker':
			return 'blocker';
		case 'spike':
			return 'spike';
		case 'doc_update':
			return 'documentation';
		case 'agent_prompt':
			return 'agent';
		case 'follow_up':
			return 'follow-up';
		default:
			return 'task';
	}
}

function priorityLabel(priority: string): string {
	switch (priority) {
		case 'low':
			return 'priority/low';
		case 'medium':
			return 'priority/medium';
		case 'high':
			return 'priority/high';
		case 'critical':
			return 'priority/critical';
		default:
			return '';
	}
}

function statusLabel(status: string): string {
	switch (status) {
		case 'blocked':
			return '🚫 BLOCKED';
		case 'reviewing':
			return '👁️ REQUIRES REVIEW';
		case 'deferred':
		case 'draft':
			return '⏸️ DEFERRED';
		case 'done':
			return '✅ Done';
		case 'ready':
		case 'planned':
			return '📋 Planned';
		default:
			return `\`${status}\``;
	}
}

// ---------------------------------------------------------------------------
// Render a single issue file
// ---------------------------------------------------------------------------

function renderIssueFile(
	item: ExecutivePlanJsonItem,
	plan: ExecutivePlanJson,
	meta: ExecutiveExportResultMetadata,
): string {
	const lines: string[] = [];
	const labels: string[] = [];

	// Title
	lines.push(`# ${item.title}`, '');

	// Derived warning
	lines.push(
		'> ⚠️ **DERIVED / NON-CANONICAL SNAPSHOT**',
		'> This is a local file export only. No GitHub issue has been created.',
		'> This file is a derived Executive Axis snapshot for review.',
		'',
	);

	// Labels (as Markdown metadata)
	const typeLabel = itemToTypeLabel(item.type);
	labels.push(typeLabel);
	const prioLabel = priorityLabel(item.priority);
	if (prioLabel) labels.push(prioLabel);
	labels.push(item.status);
	lines.push(`**Labels:** ${labels.join(', ')}`, '');
	lines.push(`**Status:** ${statusLabel(item.status)}`, '');

	// Body / Description
	lines.push('## Description', '', item.description, '');

	// Context metadata
	lines.push('## Context', '');
	lines.push(`- **LOGOS Item ID:** \`${item.id}\``);
	lines.push(`- **Type:** \`${item.type}\``);
	lines.push(`- **Priority:** \`${item.priority}\``);
	if (item.initiativeId) {
		lines.push(`- **Initiative:** \`${item.initiativeId}\``);
	}
	if (item.workstreamId) {
		lines.push(`- **Workstream:** \`${item.workstreamId}\``);
	}
	lines.push('');

	// Acceptance Criteria
	if (item.acceptanceCriteria.length > 0) {
		lines.push('## Acceptance Criteria', '');
		for (const c of item.acceptanceCriteria) {
			lines.push(`- [ ] ${c}`);
		}
		lines.push('');
	}

	// Dependencies
	if (item.dependsOn.length > 0) {
		lines.push('## Dependencies', '');
		for (const d of item.dependsOn) {
			lines.push(`- \`${d}\``);
		}
		lines.push('');
	}

	// Source Documents
	if (item.sourceNormativeDocuments.length > 0) {
		lines.push('## Source Normative Documents', '');
		for (const d of item.sourceNormativeDocuments) {
			lines.push(`- \`${d}\``);
		}
		lines.push('');
	}

	// Blockers
	const blockerItems =
		plan.execution.items?.filter(
			(i) => item.dependsOn.includes(i.id) && i.status === 'blocked',
		) ?? [];
	if (blockerItems.length > 0) {
		lines.push('## Blockers', '');
		for (const b of blockerItems) {
			lines.push(`- 🚫 **${escapeMdInline(b.title)}** (\`${b.id}\`)`);
		}
		lines.push('');
	}

	// Risks
	const riskItems =
		plan.execution.risks?.filter((r) =>
			item.sourceNormativeDocuments.some((d) =>
				r.sourceNormativeDocuments.includes(d),
			),
		) ?? [];
	if (riskItems.length > 0) {
		lines.push('## Related Risks', '');
		for (const r of riskItems) {
			lines.push(
				`- **${escapeMdInline(r.title)}** (\`${r.id}\`): ${r.description}`,
			);
		}
		lines.push('');
	}

	// Traceability
	lines.push('## Traceability', '');
	lines.push(`- **Source Plan:** \`${meta.sourcePlanId}\``);
	lines.push(`- **Plan Fingerprint:** ${meta.sourcePlanFingerprint}`);
	lines.push(
		`- **Profile:** ${meta.profileId}${meta.profileVersion ? ` v${meta.profileVersion}` : ''}`,
	);
	lines.push(`- **Generated At:** ${meta.generatedAt}`);
	lines.push('');

	// LOGOS metadata block
	lines.push('## LOGOS Metadata', '');
	lines.push('```json');
	lines.push(
		JSON.stringify(
			{
				acceptance_criteria: item.acceptanceCriteria,
				depends_on: item.dependsOn,
				derived: true,
				external_api_execution: false,
				id: item.id,
				initiative_id: item.initiativeId ?? null,
				is_canonical: false,
				non_canonical: true,
				origin: item.origin,
				plan_fingerprint: meta.sourcePlanFingerprint,
				plan_id: meta.sourcePlanId,
				priority: item.priority,
				profile_id: meta.profileId,
				profile_version: meta.profileVersion ?? null,
				requires_review: item.requiresReview,
				snapshot: true,
				source_documents: item.sourceNormativeDocuments,
				status: item.status,
				type: item.type,
				workstream_id: item.workstreamId ?? null,
			},
			null,
			2,
		),
	);
	lines.push('```', '');
	lines.push('---');
	lines.push('*Local file export — no GitHub issue created.*');

	return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Item type filter for issue exports (items that become issues)
// ---------------------------------------------------------------------------

const ISSUE_ITEM_TYPES = new Set([
	'task',
	'bug',
	'risk',
	'review',
	'decision',
	'question',
	'blocker',
	'spike',
	'doc_update',
	'follow_up',
	'agent_prompt',
	'artifact',
]);

function isExportableItem(item: ExecutivePlanJsonItem): boolean {
	return ISSUE_ITEM_TYPES.has(item.type);
}

// ---------------------------------------------------------------------------
// Sort items deterministically
// ---------------------------------------------------------------------------

function sortItems(
	items: readonly ExecutivePlanJsonItem[],
): ExecutivePlanJsonItem[] {
	return [...items].sort((a, b) => {
		// Sort by initiative, then workstream, then status, then id
		const iniA = a.initiativeId ?? '';
		const iniB = b.initiativeId ?? '';
		if (iniA !== iniB) return iniA.localeCompare(iniB);
		const wsA = a.workstreamId ?? '';
		const wsB = b.workstreamId ?? '';
		if (wsA !== wsB) return wsA.localeCompare(wsB);

		// Status order: blocked first, then reviewing, then planned, then done
		const statusOrder: Record<string, number> = {
			blocked: 0,
			cancelled: 5,
			done: 4,
			draft: 2,
			planned: 3,
			ready: 3,
			requires_review: 1,
			reviewing: 1,
			superseded: 5,
		};
		const soA = statusOrder[a.status] ?? 99;
		const soB = statusOrder[b.status] ?? 99;
		if (soA !== soB) return soA - soB;
		return a.id.localeCompare(b.id);
	});
}

// ---------------------------------------------------------------------------
// Security checks
// ---------------------------------------------------------------------------

function runSecurityChecks(allContent: string): ExecutiveExportSecuritySummary {
	const checks: ExecutiveExportSecurityCheck[] = [
		{
			checkId: 'no_raw_tokens',
			name: 'No raw provider tokens',
			passed: !/sk-[a-zA-Z0-9]{20,}/.test(allContent),
		},
		{
			checkId: 'no_auth_headers',
			name: 'No authorization headers',
			passed: !/bearer [a-zA-Z0-9_.-]{20,}/i.test(allContent),
		},
		{
			checkId: 'no_private_keys',
			name: 'No private keys',
			passed: !/-----BEGIN (RSA|EC|OPENSSH|DSA) PRIVATE KEY-----/.test(
				allContent,
			),
		},
		{
			checkId: 'no_github_claim',
			name: 'No GitHub issue creation claim',
			passed: !allContent.includes('GitHub issue has been created'),
		},
		{
			checkId: 'no_live_sync',
			name: 'No live sync claim',
			passed: !/live[- ]?sync/.test(allContent.toLowerCase()),
		},
	];

	const allPassed = checks.every((c) => c.passed);
	return { checks, passed: allPassed };
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

function render(
	input: ExecutiveExportInput,
	options: ExecutiveExportOptions = {},
): ExecutiveExportResult {
	const diagnostics: ExecutiveExportDiagnostic[] = [];
	const plan = input.plan;
	const mapping = input.mapping;
	const timestamp = options.injectTimestamp ?? input.clock();

	const sourceCanonicalDocIds: string[] = Array.isArray(
		plan.source.normativeDocuments,
	)
		? (plan.source.normativeDocuments as string[])
		: [];

	const meta: ExecutiveExportResultMetadata = {
		derivedSnapshot: true,
		externalApiExecution: false,
		generatedAt: timestamp,
		nonCanonical: true,
		profileId: input.profileId,
		profileVersion: input.profileVersion,
		readinessStatus: input.readinessStatus,
		schemaValidationStatus: 'passed',
		sourceCanonicalDocumentIds: sourceCanonicalDocIds,
		sourceCanonicalPaths: sourceCanonicalDocIds.map(
			(d) => `${input.documentationRoot}${d}.md`,
		),
		sourcePlanFingerprint: input.planFingerprint,
		sourcePlanId: input.planId,
	};

	// Filter and sort exportable items
	const exportableItems = sortItems(
		(plan.execution.items ?? []).filter(isExportableItem),
	);

	// Build output dir from mapping
	const basePath =
		mapping.outputPath ?? 'outcomes/executive/exports/github-issues/';

	// Generate one file per item
	const renderedFiles = exportableItems.map((item, index) => {
		const content = renderIssueFile(item, plan, meta);
		const checksum = createHash('sha256')
			.update(content)
			.digest('hex')
			.slice(0, 16);
		const filename = `${String(index + 1).padStart(3, '0')}-${item.id}.md`;
		const relativePath = `${basePath}${filename}`;

		return {
			checksum,
			content,
			format: 'markdown',
			relativePath,
			targetId: `${mapping.mappingId}-issue-${item.id}`,
		};
	});

	// If no items to export, render a summary
	if (exportableItems.length === 0) {
		const summary = `# No Exportable Work Items\n\nNo work items matched the GitHub Issue export filter.\n\n*Local file export — no GitHub issue created.*\n`;
		renderedFiles.push({
			checksum: createHash('sha256').update(summary).digest('hex').slice(0, 16),
			content: summary,
			format: 'markdown',
			relativePath: `${basePath}README.md`,
			targetId: `${mapping.mappingId}-summary`,
		});
	}

	const allContent = renderedFiles.map((f) => f.content).join('\n\n---\n\n');
	const securitySummary = runSecurityChecks(allContent);

	const targetId = options.injectTargetId ?? `${mapping.mappingId}-export`;

	return {
		adapterKind: 'github_issue_file',
		changedPaths: [],
		diagnostics,
		metadata: meta,
		readOnly: true,
		renderedFiles,
		securitySummary,
		supportStatus: 'supported_file_export',
		targetId,
		title: `GitHub Issue-Compatible File Export (${exportableItems.length} items)`,
	};
}
