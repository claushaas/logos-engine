/** Step 11.3 — Executive Agent Pack-Compatible File Export Adapter */

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

export const executiveAgentPackExportAdapter: ExecutiveExportAdapter = {
	kind: 'agent_pack_file',
	render,
	supportStatus: 'supported_file_export',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function escapeMdInline(s: string): string {
	return s.replace(/[\\`*_{}[\]()#+\-.!|<>]/g, '\\$&');
}

// ---------------------------------------------------------------------------
// Item types supported for agent packs
// ---------------------------------------------------------------------------

const AGENT_PACK_ITEM_TYPES = new Set([
	'task',
	'bug',
	'spike',
	'doc_update',
	'review',
	'agent_prompt',
	'decision',
	'risk',
	'blocker',
]);

function isAgentPackItem(item: ExecutivePlanJsonItem): boolean {
	return AGENT_PACK_ITEM_TYPES.has(item.type);
}

// ---------------------------------------------------------------------------
// Sort items deterministically
// ---------------------------------------------------------------------------

function sortItems(
	items: readonly ExecutivePlanJsonItem[],
): ExecutivePlanJsonItem[] {
	return [...items].sort((a, b) => {
		const iniA = a.initiativeId ?? '';
		const iniB = b.initiativeId ?? '';
		if (iniA !== iniB) return iniA.localeCompare(iniB);
		const wsA = a.workstreamId ?? '';
		const wsB = b.workstreamId ?? '';
		if (wsA !== wsB) return wsA.localeCompare(wsB);
		const statusOrder: Record<string, number> = {
			blocked: 0,
			done: 4,
			planned: 2,
			ready: 3,
			reviewing: 1,
		};
		const soA = statusOrder[a.status] ?? 99;
		const soB = statusOrder[b.status] ?? 99;
		if (soA !== soB) return soA - soB;
		return a.id.localeCompare(b.id);
	});
}

// ---------------------------------------------------------------------------
// Render a single agent pack task file
// ---------------------------------------------------------------------------

function renderAgentTaskFile(
	item: ExecutivePlanJsonItem,
	plan: ExecutivePlanJson,
	meta: ExecutiveExportResultMetadata,
): string {
	const lines: string[] = [];

	// Header
	lines.push(`# Agent Task: ${item.title}`, '');

	// Derived execution-aid warning
	lines.push(
		'> ⚠️ **DERIVED / NON-CANONICAL EXECUTION AID**',
		'> ',
		'> This file is a derived Executive Axis agent task export snapshot.',
		'> It is an **execution aid**, not a canonical source of truth.',
		'> No downstream agent has been executed. No external systems were contacted.',
		'> The canonical source of truth is the normative documentation baseline.',
		'',
	);

	// Objective
	lines.push('## Objective', '', item.description, '');

	// Execution Context
	lines.push('## Execution Context', '');
	lines.push(`- **LOGOS Item ID:** \`${item.id}\``);
	lines.push(`- **Type:** \`${item.type}\``);
	lines.push(`- **Priority:** \`${item.priority}\``);
	if (item.initiativeId) {
		lines.push(`- **Initiative:** \`${item.initiativeId}\``);
	}
	if (item.workstreamId) {
		lines.push(`- **Workstream:** \`${item.workstreamId}\``);
	}
	if (item.suggestedExecutor) {
		lines.push(
			`- **Suggested Executor:** ${item.suggestedExecutor.type}${item.suggestedExecutor.agentProfile ? ` (${item.suggestedExecutor.agentProfile})` : ''}`,
		);
	}
	lines.push('');

	// Source Normative Documents
	if (item.sourceNormativeDocuments.length > 0) {
		lines.push('## Source Normative Documents', '');
		for (const d of item.sourceNormativeDocuments) {
			lines.push(`- \`${d}\``);
		}
		lines.push('');
	}

	// Current status & blockers
	const statLabel =
		item.status === 'blocked'
			? '🚫 BLOCKED'
			: item.status === 'reviewing'
				? '👁️ REQUIRES REVIEW'
				: item.status === 'draft'
					? '⏸️ DEFERRED'
					: '📋 Planned';
	lines.push(`**Status:** ${statLabel}  `);

	if (item.requiresReview) {
		lines.push(
			'**⚠️ Requires Review:** This work item is marked as requiring review.',
			'',
		);
	}

	// Dependencies & Blockers
	if (item.dependsOn.length > 0) {
		const blockerItems =
			plan.execution.items?.filter(
				(i) => item.dependsOn.includes(i.id) && i.status === 'blocked',
			) ?? [];
		const nonBlockerDeps = item.dependsOn.filter(
			(d) => !blockerItems.find((b) => b.id === d),
		);

		if (blockerItems.length > 0) {
			lines.push('## Blockers', '');
			for (const b of blockerItems) {
				lines.push(`- 🚫 **${escapeMdInline(b.title)}** (\`${b.id}\`)`);
			}
			lines.push('');
		}

		if (nonBlockerDeps.length > 0) {
			lines.push('## Dependencies', '');
			for (const d of nonBlockerDeps) {
				lines.push(`- \`${d}\``);
			}
			lines.push('');
		}
	}

	// Related Risks
	const relatedRisks =
		plan.execution.risks?.filter((r) =>
			item.sourceNormativeDocuments.some((d) =>
				r.sourceNormativeDocuments.includes(d),
			),
		) ?? [];
	if (relatedRisks.length > 0) {
		lines.push('## Related Risks', '');
		for (const r of relatedRisks) {
			lines.push(
				`- **${escapeMdInline(r.title)}** (\`${r.id}\`): ${r.description}`,
			);
		}
		lines.push('');
	}

	// Required Work / Instructions
	lines.push('## Required Work', '');
	lines.push(
		`Generate the output for this ${item.type} work item based on the source documents and acceptance criteria below.`,
		'',
	);
	if (item.suggestedExecutor?.type === 'agent') {
		lines.push(
			'This is an agent-suggested task. Follow the automated workflow.',
			'',
		);
	}

	// Acceptance Criteria
	if (item.acceptanceCriteria.length > 0) {
		lines.push('## Acceptance Criteria', '');
		for (const c of item.acceptanceCriteria) {
			lines.push(`- [ ] ${c}`);
		}
		lines.push('');
	}

	// Expected Outputs
	lines.push('## Expected Outputs', '');
	const suggestedExportKeys = item.suggestedExports
		? Object.keys(item.suggestedExports)
		: [];
	if (suggestedExportKeys.length > 0) {
		for (const key of suggestedExportKeys) {
			lines.push(`- ${key}`);
		}
	} else {
		const outputCount = item.acceptanceCriteria.length;
		if (outputCount > 0) {
			lines.push(
				`- Deliver work that satisfies all ${outputCount} acceptance criteria.`,
			);
		} else {
			lines.push('- Deliver work as described in the objective.');
		}
	}
	lines.push('');

	// Constraints
	lines.push('## Constraints', '');
	lines.push('- Do **not** change unrelated files or make unrelated changes.');
	lines.push(
		'- Preserve existing repository conventions and directory structure.',
	);
	lines.push(
		'- Do **not** treat generated or derived artifacts as canonical source unless explicitly instructed.',
	);
	lines.push('- Preserve source traceability and metadata.');
	lines.push(
		'- Do **not** exfiltrate secrets, tokens, private keys, or sensitive data.',
	);
	lines.push(
		'- Do **not** call external APIs unless explicitly authorized in the source documents.',
	);
	const nonGoalsMeta = item.metadata?.nonGoals as string[] | undefined;
	if (nonGoalsMeta && nonGoalsMeta.length > 0) {
		lines.push('', '### Non-Goals', '');
		for (const ng of nonGoalsMeta) {
			lines.push(`- ${ng}`);
		}
	}
	lines.push('');

	// Unresolved questions
	if (item.requiresReview) {
		lines.push('## Unresolved Items', '');
		lines.push(
			'⚠️ This work item requires human review before execution. Some decisions may be pending.',
			'',
		);
		if (item.status === 'blocked') {
			lines.push(
				'🚫 This work item is currently blocked by upstream dependencies.',
				'',
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
	lines.push(`- **Origin:** ${item.origin}`);
	if (item.suggestedExports && Object.keys(item.suggestedExports).length > 0) {
		lines.push(
			`- **Suggested Exports:** ${Object.keys(item.suggestedExports).join(', ')}`,
		);
	}
	lines.push('');

	// Response requirements
	lines.push('## Response Requirements', '');
	lines.push('After completing the work, provide:');
	lines.push('1. Summary of changes made.');
	lines.push('2. Files changed.');
	lines.push('3. Validation performed.');
	lines.push('4. Remaining risks or follow-up items.');
	lines.push('');

	lines.push('---');
	lines.push(
		'*Derived execution aid — local file export. No downstream agent executed. No external systems contacted.*',
	);

	return lines.join('\n');
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
			checkId: 'no_unrelated_changes_override',
			name: 'No instruction to ignore source constraints',
			passed:
				!allContent.includes('ignore all constraints') &&
				!allContent.includes('disregard source documents'),
		},
		{
			checkId: 'no_exfiltrate',
			name: 'No instruction to exfiltrate secrets',
			passed:
				!allContent.includes('exfiltrate') &&
				!allContent.includes('send credentials'),
		},
		{
			checkId: 'no_agent_executed_claim',
			name: 'No agent execution claim',
			passed: !allContent.includes('agent has been executed'),
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
		(plan.execution.items ?? []).filter(isAgentPackItem),
	);

	const basePath =
		mapping.outputPath ?? 'outcomes/executive/exports/agent-packs/';

	// Generate one file per item
	const renderedFiles = exportableItems.map((item, index) => {
		const content = renderAgentTaskFile(item, plan, meta);
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
			targetId: `${mapping.mappingId}-task-${item.id}`,
		};
	});

	// If no items, render summary
	if (exportableItems.length === 0) {
		const summary = `# No Agent Pack-Compatible Work Items\n\nNo work items matched the Agent Pack export filter.\n\n*Local file export — no downstream agent executed.*\n`;
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
		adapterKind: 'agent_pack_file',
		changedPaths: [],
		diagnostics,
		metadata: meta,
		readOnly: true,
		renderedFiles,
		securitySummary,
		supportStatus: 'supported_file_export',
		targetId,
		title: `Agent Pack-Compatible File Export (${exportableItems.length} items)`,
	};
}
