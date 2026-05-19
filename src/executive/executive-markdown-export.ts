/** Step 11.3 — Executive Markdown Export Adapter */

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
import type { ExecutivePlanJson } from './executive-plan-model.js';

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export const executiveMarkdownExportAdapter: ExecutiveExportAdapter = {
	kind: 'markdown',
	render,
	supportStatus: 'supported_file_export',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function escapeMdInline(s: string): string {
	return s.replace(/[\\`*_{}[\]()#+\-.!|<>]/g, '\\$&');
}

function renderSeparator(): string {
	return '\n\n---\n\n';
}

function renderWarningBlock(): string {
	return [
		'> **⚠️ DERIVED / NON-CANONICAL SNAPSHOT**',
		'> ',
		'> This document is a derived Executive Axis export snapshot.',
		'> It is **not** a canonical source of truth.',
		'> The canonical source of truth is the normative documentation baseline and structured `.logos/` state.',
		'> This export does **not** represent live task management or external system state.',
		'',
	].join('\n');
}

function renderMetadataBlock(meta: ExecutiveExportResultMetadata): string {
	const lines: string[] = [
		'<!--',
		`  artifactType: executive_markdown_export`,
		`  canonical: false`,
		`  derived: true`,
		`  snapshot: true`,
		`  sourcePlanId: ${meta.sourcePlanId}`,
		`  sourcePlanFingerprint: ${meta.sourcePlanFingerprint}`,
		`  profileId: ${meta.profileId}`,
	];
	if (meta.profileVersion) {
		lines.push(`  profileVersion: ${meta.profileVersion}`);
	}
	lines.push(
		`  generatedAt: ${meta.generatedAt}`,
		`  readinessStatus: ${meta.readinessStatus}`,
		`  sourceCanonicalDocIds:`,
	);
	for (const docId of meta.sourceCanonicalDocumentIds) {
		lines.push(`    - ${docId}`);
	}
	lines.push('-->', '');
	return lines.join('\n');
}

function renderTitle(title: string): string {
	return `# Executive Axis: ${title}\n`;
}

function renderSummarySection(plan: ExecutivePlanJson): string {
	const lines: string[] = [
		'## Summary',
		'',
		`**Project:** ${escapeMdInline(plan.project.name)} (${escapeMdInline(plan.project.id)})  `,
		`**Plan ID:** \`${plan.id}\`  `,
		`**Version:** ${plan.version}  `,
		`**Generated At:** ${plan.generatedAt}  `,
		`**Readiness Status:** \`${plan.source.readinessStatus}\`  `,
		`**Overall Confidence:** ${plan.confidence.overall}`,
		'',
		plan.project.description ? `${plan.project.description}\n` : '',
	];
	return lines.join('\n');
}

function renderReadinessSection(plan: ExecutivePlanJson): string {
	const lines: string[] = [
		'## Readiness Snapshot',
		'',
		`**Status:** \`${plan.source.readinessStatus}\``,
		`**Warnings:** ${plan.source.warnings.length}`,
		'',
	];
	if (plan.source.warnings.length > 0) {
		for (const w of plan.source.warnings) {
			lines.push(`- ⚠️ ${w}`);
		}
		lines.push('');
	}

	if (plan.metadata && typeof plan.metadata === 'object') {
		const meta = plan.metadata as Record<string, unknown>;
		if (meta.readinessSummary) {
			const rs = meta.readinessSummary as Record<string, unknown>;
			lines.push(
				'### Baseline Summary',
				'',
				`- Total Documents: ${rs.totalDocuments ?? 'N/A'}`,
				`- Satisfied: ${rs.satisfiedDocuments ?? 'N/A'}`,
				`- Warning: ${rs.warningDocuments ?? 'N/A'}`,
				`- Blocked: ${rs.blockedDocuments ?? 'N/A'}`,
				`- Unknown: ${rs.unknownDocuments ?? 'N/A'}`,
				`- Blockers: ${rs.blockerCount ?? 'N/A'}`,
				`- Warnings: ${rs.warningCount ?? 'N/A'}`,
				'',
			);
		}
	}
	return lines.join('\n');
}

function renderRoadmapsSection(plan: ExecutivePlanJson): string {
	if (!plan.execution.roadmaps || plan.execution.roadmaps.length === 0) {
		return '## Roadmap\n\n_No roadmaps defined._\n';
	}
	const lines: string[] = ['## Roadmap', ''];
	for (const r of plan.execution.roadmaps) {
		lines.push(
			`### ${escapeMdInline(r.title)}`,
			'',
			r.description,
			'',
			`- **Status:** \`${r.status}\``,
			`- **Horizon:** ${r.horizon}`,
			`- **Milestones:** ${r.milestoneIds.join(', ')}`,
			'',
		);
	}
	return lines.join('\n');
}

function statusLabel(status: string): string {
	switch (status) {
		case 'blocked':
			return '🚫 BLOCKED';
		case 'requires_review':
		case 'reviewing':
			return '👁️ REQUIRES REVIEW';
		case 'deferred':
			return '⏸️ DEFERRED';
		case 'done':
			return '✅ Done';
		case 'planned':
		case 'ready':
			return '📋 Planned';
		default:
			return `\`${status}\``;
	}
}

function renderMilestonesSection(plan: ExecutivePlanJson): string {
	if (!plan.execution.milestones || plan.execution.milestones.length === 0) {
		return '## Milestones\n\n_No milestones defined._\n';
	}
	const lines: string[] = ['## Milestones', ''];
	for (const m of plan.execution.milestones) {
		const statusLabelStr =
			m.status === 'blocked'
				? '🚫 BLOCKED'
				: m.status === 'reviewing'
					? '👁️ REQUIRES REVIEW'
					: `\`${m.status}\``;
		lines.push(
			`### ${escapeMdInline(m.title)}`,
			'',
			`**ID:** \`${m.id}\` | **Status:** ${statusLabelStr}`,
			'',
			m.objective,
			'',
		);
		if (m.exitCriteria.length > 0) {
			lines.push('**Exit Criteria:**');
			for (const c of m.exitCriteria) {
				lines.push(`- [ ] ${c}`);
			}
			lines.push('');
		}
	}
	return lines.join('\n');
}

function renderInitiativesSection(plan: ExecutivePlanJson): string {
	if (!plan.execution.initiatives || plan.execution.initiatives.length === 0) {
		return '## Initiatives\n\n_No initiatives defined._\n';
	}
	const lines: string[] = ['## Initiatives', ''];
	for (const ini of plan.execution.initiatives) {
		const statusLabelStr =
			ini.status === 'blocked'
				? '🚫 BLOCKED'
				: ini.status === 'reviewing'
					? '👁️ REQUIRES REVIEW'
					: `\`${ini.status}\``;
		lines.push(
			`### ${escapeMdInline(ini.title)}`,
			'',
			`**ID:** \`${ini.id}\` | **Status:** ${statusLabelStr}`,
			'',
			ini.purpose,
			'',
		);
		if (ini.deliverables.length > 0) {
			lines.push('**Deliverables:**');
			for (const d of ini.deliverables) {
				lines.push(`- \`${d}\``);
			}
			lines.push('');
		}
		if (ini.itemIds.length > 0) {
			lines.push(`**Items:** ${ini.itemIds.join(', ')}`, '');
		}
	}
	return lines.join('\n');
}

function renderWorkItemsSection(plan: ExecutivePlanJson): string {
	if (!plan.execution.items || plan.execution.items.length === 0) {
		return '## Work Items\n\n_No work items defined._\n';
	}
	const lines: string[] = ['## Work Items', ''];
	for (const item of plan.execution.items) {
		const statLabel = statusLabel(item.status);
		lines.push(
			`### ${escapeMdInline(item.title)}`,
			'',
			`**ID:** \`${item.id}\` | **Type:** \`${item.type}\` | **Status:** ${statLabel} | **Priority:** \`${item.priority}\``,
			'',
			item.description,
			'',
		);
		if (item.initiativeId) {
			lines.push(`- **Initiative:** \`${item.initiativeId}\``);
		}
		if (item.workstreamId) {
			lines.push(`- **Workstream:** \`${item.workstreamId}\``);
		}
		if (item.dependsOn.length > 0) {
			lines.push(
				'- **Dependencies:**',
				...item.dependsOn.map((d) => `  - \`${d}\``),
			);
		}
		if (item.acceptanceCriteria.length > 0) {
			lines.push(
				'',
				'**Acceptance Criteria:**',
				...item.acceptanceCriteria.map((c) => `- [ ] ${c}`),
			);
		}
		if (item.sourceNormativeDocuments.length > 0) {
			lines.push(
				'',
				'**Source Documents:**',
				...item.sourceNormativeDocuments.map((d) => `- \`${d}\``),
			);
		}
		lines.push('');
	}
	return lines.join('\n');
}

function renderDependenciesSection(plan: ExecutivePlanJson): string {
	const deps = buildDepSummary(plan);
	if (deps.length === 0) {
		return '## Dependencies\n\n_No dependencies recorded._\n';
	}
	const lines: string[] = ['## Dependencies', ''];
	for (const dep of deps) {
		lines.push(`- \`${dep.from}\` → \`${dep.to}\` (${dep.kind})`);
	}
	lines.push('');
	return lines.join('\n');
}

function buildDepSummary(
	plan: ExecutivePlanJson,
): { from: string; to: string; kind: string }[] {
	const deps: { from: string; to: string; kind: string }[] = [];
	const depMap = new Map<string, boolean>();
	for (const item of plan.execution.items ?? []) {
		for (const depId of item.dependsOn) {
			const key = `${item.id}->${depId}`;
			if (!depMap.has(key)) {
				depMap.set(key, true);
				deps.push({ from: item.id, kind: 'depends_on', to: depId });
			}
		}
	}
	return deps;
}

function renderBlockersSection(plan: ExecutivePlanJson): string {
	const blockers =
		plan.execution.items?.filter((i) => i.status === 'blocked') ?? [];
	const rcItems =
		plan.execution.items?.filter((i) => i.status === 'reviewing') ?? [];
	const deferredItems =
		plan.execution.items?.filter(
			(i) => i.status === 'draft' && i.type === 'blocker',
		) ?? [];

	if (
		blockers.length === 0 &&
		rcItems.length === 0 &&
		deferredItems.length === 0
	) {
		return '## Blockers & Requires Review\n\n_No blocked or review-required items._\n';
	}
	const lines: string[] = ['## Blockers & Requires Review', ''];

	if (blockers.length > 0) {
		lines.push('### 🚫 Blocked');
		for (const b of blockers) {
			lines.push(
				`- **${escapeMdInline(b.title)}** (\`${b.id}\`) — ${b.priority}`,
			);
		}
		lines.push('');
	}
	if (rcItems.length > 0) {
		lines.push('### 👁️ Requires Review');
		for (const b of rcItems) {
			lines.push(`- **${escapeMdInline(b.title)}** (\`${b.id}\`)`);
		}
		lines.push('');
	}
	if (deferredItems.length > 0) {
		lines.push('### ⏸️ Deferred');
		for (const b of deferredItems) {
			lines.push(`- **${escapeMdInline(b.title)}** (\`${b.id}\`)`);
		}
		lines.push('');
	}
	return lines.join('\n');
}

function renderRisksSection(plan: ExecutivePlanJson): string {
	if (!plan.execution.risks || plan.execution.risks.length === 0) {
		return '## Risks\n\n_No risks recorded._\n';
	}
	const lines: string[] = ['## Risks', ''];
	for (const r of plan.execution.risks) {
		lines.push(
			`### ${escapeMdInline(r.title)}`,
			'',
			`**ID:** \`${r.id}\` | **Likelihood:** ${r.likelihood} | **Impact:** ${r.impact}`,
			'',
			r.description,
			'',
			`**Mitigation:** ${r.mitigation || '_None provided_'}`,
			'',
		);
	}
	return lines.join('\n');
}

function renderDecisionsSection(plan: ExecutivePlanJson): string {
	if (!plan.execution.decisions || plan.execution.decisions.length === 0) {
		return '## Decisions\n\n_No decisions recorded._\n';
	}
	const lines: string[] = ['## Decisions', ''];
	for (const d of plan.execution.decisions) {
		lines.push(
			`### ${escapeMdInline(d.title)}`,
			'',
			`**ID:** \`${d.id}\` | **Status:** \`${d.status}\``,
			'',
			d.context || '',
			'',
			`**Decision:** ${d.decision}`,
			'',
		);
		if (d.consequences.length > 0) {
			lines.push('**Consequences:**');
			for (const c of d.consequences) {
				lines.push(`- ${c}`);
			}
			lines.push('');
		}
	}
	return lines.join('\n');
}

function renderAcceptanceCriteriaSection(plan: ExecutivePlanJson): string {
	const allCriteria: { criterion: string; itemId: string }[] = [];
	for (const item of plan.execution.items ?? []) {
		for (const ac of item.acceptanceCriteria) {
			allCriteria.push({ criterion: ac, itemId: item.id });
		}
	}
	if (allCriteria.length === 0) {
		return '## Acceptance Criteria\n\n_No acceptance criteria defined._\n';
	}
	const lines: string[] = ['## Acceptance Criteria', ''];
	for (const ac of allCriteria) {
		lines.push(`- [ ] (\`${ac.itemId}\`) ${ac.criterion}`);
	}
	lines.push('');
	return lines.join('\n');
}

function renderTraceabilitySection(
	meta: ExecutiveExportResultMetadata,
): string {
	const lines: string[] = [
		'## Traceability',
		'',
		`**Source Plan:** \`${meta.sourcePlanId}\`  `,
		`**Plan Fingerprint:** ${meta.sourcePlanFingerprint}  `,
		`**Profile:** ${meta.profileId}${meta.profileVersion ? ` v${meta.profileVersion}` : ''}  `,
		`**Readiness:** ${meta.readinessStatus}  `,
		'',
		'### Source Canonical Documents',
	];
	for (const docId of meta.sourceCanonicalDocumentIds) {
		lines.push(`- \`${docId}\``);
	}
	if (meta.sourceCanonicalPaths.length > 0) {
		lines.push('', '### Source Paths');
		for (const path of meta.sourceCanonicalPaths) {
			lines.push(`- \`${path}\``);
		}
	}
	lines.push('');
	return lines.join('\n');
}

function renderExportMetadataSection(
	meta: ExecutiveExportResultMetadata,
	plan: ExecutivePlanJson,
): string {
	const exportConfigs = plan.exports ?? {};
	const lines: string[] = [
		'## Export Metadata',
		'',
		`**Generated At:** ${meta.generatedAt}  `,
		`**Derived Snapshot:** true  `,
		`**Non-Canonical:** true  `,
		`**External API Execution:** false  `,
		'',
		'### Export Targets',
	];
	for (const [key, config] of Object.entries(exportConfigs)) {
		const cfg = config as Record<string, unknown>;
		const enabled = cfg.enabled ?? false;
		const status = cfg.supportStatus ?? 'unknown';
		lines.push(
			`- **${key}:** enabled=${String(enabled)}, status=${String(status)}`,
		);
	}
	lines.push('');
	return lines.join('\n');
}

function renderDiagnosticsSection(
	diagnostics: readonly ExecutiveExportDiagnostic[],
): string {
	if (diagnostics.length === 0) return '';
	const lines: string[] = ['## Diagnostics', ''];
	for (const d of diagnostics) {
		lines.push(`- **\`${d.severity}\`** ${d.code}: ${d.message}`);
		if (d.recoveryHint) {
			lines.push(`  _Hint: ${d.recoveryHint}_`);
		}
	}
	lines.push('');
	return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Security checks
// ---------------------------------------------------------------------------

function runSecurityChecks(content: string): ExecutiveExportSecuritySummary {
	const checks: ExecutiveExportSecurityCheck[] = [];

	// Raw provider token check
	const secretPatterns = [
		{
			id: 'no_raw_tokens',
			name: 'No raw provider tokens',
			pattern: /sk-[a-zA-Z0-9]{20,}/,
		},
		{
			id: 'no_auth_headers',
			name: 'No authorization headers',
			pattern: /bearer [a-zA-Z0-9_.-]{20,}/i,
		},
		{
			id: 'no_private_keys',
			name: 'No private keys',
			pattern: /-----BEGIN (RSA|EC|OPENSSH|DSA) PRIVATE KEY-----/,
		},
		{
			id: 'no_env_values',
			name: 'No raw env values',
			pattern: /(AKIA|ghp_|xoxb-|xoxp-|dapi_|sl\.)[a-zA-Z0-9_-]{20,}/,
		},
		{
			id: 'no_path_traversal',
			name: 'No path traversal',
			pattern: /\.\.\/\.\.\//,
		},
	];

	for (const sp of secretPatterns) {
		const passed = !sp.pattern.test(content);
		checks.push({
			checkId: sp.id,
			details: passed ? undefined : `Found pattern matching ${sp.id}`,
			name: sp.name,
			passed,
		});
	}

	// Canonical authority claim check
	const canonicalClaim =
		/canonical[:\s]+true/.test(content) &&
		!content.includes('canonical: false');
	checks.push({
		checkId: 'no_canonical_claim',
		details: canonicalClaim ? 'Content claims canonical authority' : undefined,
		name: 'No canonical authority claim',
		passed: !canonicalClaim,
	});

	// External API check
	const hasExternalApi = content.includes('external API execution: true');
	checks.push({
		checkId: 'no_external_api',
		name: 'No external API execution marker',
		passed: !hasExternalApi,
	});

	// Live task management check
	const hasLiveTask = /live[- ]?task[- ]?manag/.test(content.toLowerCase());
	checks.push({
		checkId: 'no_live_task_mgmt',
		name: 'No live task management claim',
		passed: !hasLiveTask,
	});

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
	const targetId = options.injectTargetId ?? `${mapping.mappingId}-export`;

	// Source metadata
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

	// Build sections
	const sections: string[] = [
		renderMetadataBlock(meta),
		renderTitle(plan.project.name),
		renderWarningBlock(),
		renderSummarySection(plan),
		renderSeparator(),
		renderReadinessSection(plan),
		renderSeparator(),
		renderRoadmapsSection(plan),
		renderSeparator(),
		renderMilestonesSection(plan),
		renderSeparator(),
		renderInitiativesSection(plan),
		renderSeparator(),
		renderWorkItemsSection(plan),
		renderSeparator(),
		renderDependenciesSection(plan),
		renderSeparator(),
		renderBlockersSection(plan),
		renderSeparator(),
		renderRisksSection(plan),
		renderSeparator(),
		renderDecisionsSection(plan),
		renderSeparator(),
		renderAcceptanceCriteriaSection(plan),
		renderSeparator(),
		renderTraceabilitySection(meta),
		renderSeparator(),
		renderExportMetadataSection(meta, plan),
	];

	const diagSection = renderDiagnosticsSection(diagnostics);
	if (diagSection) {
		sections.push(renderSeparator(), diagSection);
	}

	// Non-live-task disclaimer
	sections.push(
		'---\n\n',
		'*This is a derived Executive Axis Markdown export snapshot. ',
		'It does **not** represent live task management state. ',
		'External systems (GitHub, Linear, Notion) have not been contacted.*\n',
	);

	const content = sections.join('');
	const checksum = createHash('sha256')
		.update(content)
		.digest('hex')
		.slice(0, 16);

	// Output path from mapping
	const outputPath =
		mapping.outputPath ??
		`outcomes/executive/exports/markdown/implementation-plan.md`;

	// Security checks
	const securitySummary = runSecurityChecks(content);

	return {
		adapterKind: 'markdown',
		changedPaths: [],
		diagnostics,
		metadata: meta,
		readOnly: true,
		renderedFiles: [
			{
				checksum,
				content,
				format: 'markdown',
				relativePath: outputPath,
				targetId,
			},
		],
		securitySummary,
		supportStatus: 'supported_file_export',
		targetId,
		title: `Executive Markdown Export: ${plan.project.name}`,
	};
}
