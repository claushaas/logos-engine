/**
 * TUI Report Renderers — pure, structured report rendering helpers.
 *
 * Phase 5: TUI Workbench Redesign — Outcome 7 (report views).
 *
 * All functions are pure: they take structured data and return display lines.
 * No side effects, no provider calls, no filesystem access, no state mutation.
 *
 * Reports must:
 * - group findings by severity/status;
 * - show affected paths/documents where safe;
 * - show next actions;
 * - preserve canonical vs derived labels;
 * - avoid raw secrets (caller redacts before calling);
 * - truncate large lists safely.
 */

import {
	type StateLabelKind,
	stateLabelText,
	type TuiReportCounts,
	type TuiReportData,
	type TuiReportGroup,
	type TuiReportItem,
} from './workbench-model.js';

// ---------------------------------------------------------------------------
// Truncation
// ---------------------------------------------------------------------------

/** Maximum items to show in a group before truncation notice */
const MAX_ITEMS_PER_GROUP = 10;

/** Maximum groups to show before truncation */
const MAX_GROUPS = 8;

/**
 * Truncate a list with a "… and N more" notice.
 */
function truncateList<T>(
	items: T[],
	max: number,
): { shown: T[]; remaining: number } {
	if (items.length <= max) return { remaining: 0, shown: items };
	return {
		remaining: items.length - max,
		shown: items.slice(0, max),
	};
}

// ---------------------------------------------------------------------------
// Report count builders
// ---------------------------------------------------------------------------

/**
 * Build report counts from groups.
 */
export function buildReportCounts(groups: TuiReportGroup[]): TuiReportCounts {
	const counts: TuiReportCounts = {
		critical: 0,
		error: 0,
		info: 0,
		success: 0,
		total: 0,
		warning: 0,
	};

	for (const group of groups) {
		counts[group.severity] += group.items.length;
		counts.total += group.items.length;
	}

	return counts;
}

// ---------------------------------------------------------------------------
// Grouped findings rendering
// ---------------------------------------------------------------------------

/**
 * Build a report data structure from grouped findings.
 */
export function buildReportData(opts: {
	summary: string;
	groups: TuiReportGroup[];
	nextActions?: string[] | undefined;
	outputType?: 'canonical' | 'derived' | 'report' | undefined;
}): TuiReportData {
	return {
		counts: buildReportCounts(opts.groups),
		groups: opts.groups,
		nextActions: opts.nextActions ?? [],
		outputType: opts.outputType,
		summary: opts.summary,
	};
}

/**
 * Render a report data structure as display lines.
 */
export function renderReport(report: TuiReportData): string[] {
	const lines: string[] = [];

	// Summary
	lines.push(report.summary);
	lines.push('');

	// Output type label
	if (report.outputType) {
		const label =
			report.outputType === 'canonical'
				? stateLabelText('canonical')
				: report.outputType === 'derived'
					? stateLabelText('derived')
					: report.outputType === 'report'
						? stateLabelText('derived')
						: '';
		if (label) {
			lines.push(`Output type: ${label}`);
			lines.push('');
		}
	}

	// Counts
	lines.push(`Findings: ${report.counts.total} total`);
	if (report.counts.critical > 0)
		lines.push(`  Critical: ${report.counts.critical}`);
	if (report.counts.error > 0) lines.push(`  Errors:   ${report.counts.error}`);
	if (report.counts.warning > 0)
		lines.push(`  Warnings: ${report.counts.warning}`);
	if (report.counts.info > 0) lines.push(`  Info:     ${report.counts.info}`);
	if (report.counts.success > 0)
		lines.push(`  Success:  ${report.counts.success}`);
	lines.push('');

	// Groups
	const { shown: shownGroups, remaining: remainingGroups } = truncateList(
		report.groups,
		MAX_GROUPS,
	);

	for (const group of shownGroups) {
		const severityLabel = `[${group.severity.toUpperCase()}]`;
		lines.push(
			`${severityLabel} ${group.label}${group.reason ? ` — ${group.reason}` : ''}`,
		);

		const { shown: shownItems, remaining: remainingItems } = truncateList(
			group.items,
			MAX_ITEMS_PER_GROUP,
		);

		for (const item of shownItems) {
			let line = `  ${item.text}`;
			if (item.labelKind) {
				line = `  ${stateLabelText(item.labelKind)} ${item.text}`;
			}
			if (item.path) {
				line += ` — ${item.path}`;
			}
			lines.push(line);
			if (item.detail) {
				lines.push(`    ${item.detail}`);
			}
		}

		if (remainingItems > 0) {
			lines.push(`  ... and ${remainingItems} more in this group`);
		}
		lines.push('');
	}

	if (remainingGroups > 0) {
		lines.push(`... and ${remainingGroups} more groups`);
		lines.push('');
	}

	// Next actions
	if (report.nextActions.length > 0) {
		lines.push('Next actions:');
		for (const action of report.nextActions.slice(0, 5)) {
			lines.push(`  - ${action}`);
		}
		if (report.nextActions.length > 5) {
			lines.push(`  ... and ${report.nextActions.length - 5} more`);
		}
		lines.push('');
	}

	return lines;
}

// ---------------------------------------------------------------------------
// Validation report
// ---------------------------------------------------------------------------

export interface ValidationReportInput {
	gateStatus: string;
	findingCounts: {
		fatal: number;
		error: number;
		warning: number;
		info: number;
		total: number;
	};
	findings: Array<{
		severity: string;
		message: string;
		path?: string | undefined;
		recoveryHint?: string | undefined;
	}>;
	reportPath?: string | undefined;
	reportId?: string | undefined;
	runId?: string | undefined;
	changedPaths?: string[] | undefined;
	isDryRun?: boolean | undefined;
}

export function buildValidationReport(
	input: ValidationReportInput,
): TuiReportData {
	const groups: TuiReportGroup[] = [];

	const severities = ['fatal', 'error', 'warning', 'info'] as const;
	for (const sev of severities) {
		const items = input.findings.filter(
			(f) => f.severity.toLowerCase() === sev,
		);

		if (items.length === 0) continue;

		const severity = sev === 'fatal' ? 'critical' : sev;

		groups.push({
			items: items.map((f) => ({
				detail: f.recoveryHint,
				labelKind:
					sev === 'fatal' ? 'failed' : sev === 'error' ? 'warning' : undefined,
				path: f.path,
				text: f.message,
			})),
			label: `${sev.charAt(0).toUpperCase() + sev.slice(1)} Findings`,
			reason: `${items.length} finding(s)`,
			severity,
		});
	}

	const nextActions: string[] = [
		'Run /diagnose for analysis',
		'Run /generate to update documents',
	];

	if (input.isDryRun) {
		nextActions.push('Run /validate without --dry-run to persist report');
	}

	if (input.reportPath) {
		nextActions.push(`Review report: ${input.reportPath}`);
	}

	if (input.changedPaths && input.changedPaths.length > 0) {
		nextActions.push(
			`Changed paths: ${input.changedPaths.slice(0, 5).join(', ')}`,
		);
	}

	const statusLabel =
		input.gateStatus === 'pass'
			? stateLabelText('ready')
			: input.gateStatus === 'pass_with_warnings'
				? stateLabelText('warning')
				: stateLabelText('failed');

	return buildReportData({
		groups,
		nextActions,
		outputType: 'report',
		summary: `Validation Report ${statusLabel} — Gate: ${input.gateStatus.toUpperCase()}. ${input.findingCounts.total} findings.`,
	});
}

// ---------------------------------------------------------------------------
// Diagnostic report
// ---------------------------------------------------------------------------

export interface DiagnosticReportInput {
	gateStatus: string;
	findingCounts: {
		fatal: number;
		error: number;
		warning: number;
		info: number;
		total: number;
	};
	explanations?: Array<{ text: string }> | undefined;
	groupedFindings?: Array<{ label: string; reason: string }> | undefined;
	suggestedActions?:
		| Array<{
				priority: string;
				category: string;
				text: string;
		  }>
		| undefined;
	reportPath?: string | undefined;
	reportId?: string | undefined;
	runId?: string | undefined;
	changedPaths?: string[] | undefined;
	isDryRun?: boolean | undefined;
	interpretationSource?: string | undefined;
}

export function buildDiagnosticReport(
	input: DiagnosticReportInput,
): TuiReportData {
	const groups: TuiReportGroup[] = [];

	// Explanation as info group
	if (input.explanations && input.explanations.length > 0) {
		groups.push({
			items: input.explanations.map((e) => ({ text: e.text })),
			label: 'Analysis',
			reason: `Source: ${input.interpretationSource ?? 'deterministic'}`,
			severity: 'info',
		});
	}

	// Grouped findings
	if (input.groupedFindings && input.groupedFindings.length > 0) {
		for (const gf of input.groupedFindings.slice(0, 5)) {
			groups.push({
				items: [{ text: gf.label }],
				label: gf.label,
				reason: gf.reason,
				severity: 'warning',
			});
		}
	}

	// Suggested actions
	if (input.suggestedActions && input.suggestedActions.length > 0) {
		groups.push({
			items: input.suggestedActions.slice(0, 10).map((a) => ({
				detail: `[${a.priority.toUpperCase()}] [${a.category}]`,
				text: a.text,
			})),
			label: 'Suggested Actions',
			severity: 'info',
		});
	}

	const nextActions: string[] = [
		'Run /validate for raw findings',
		'Run /status to review state',
		'Run /continue to advance intake',
	];

	if (input.isDryRun) {
		nextActions.push('Run /diagnose without --dry-run to persist report');
	}

	const statusLabel =
		input.gateStatus === 'pass'
			? stateLabelText('ready')
			: input.gateStatus === 'pass_with_warnings'
				? stateLabelText('warning')
				: stateLabelText('failed');

	return buildReportData({
		groups,
		nextActions,
		outputType: 'report',
		summary: `Diagnostic Report ${statusLabel} — Gate: ${input.gateStatus.toUpperCase()}. ${input.findingCounts.total} findings.`,
	});
}

// ---------------------------------------------------------------------------
// Generation report
// ---------------------------------------------------------------------------

export interface GenerationReportInput {
	documentCounts: {
		generate: number;
		update: number;
		skip: number;
		incomplete: number;
		blocked: number;
		failed: number;
		stale: number;
	};
	createdPaths?: string[] | undefined;
	updatedPaths?: string[] | undefined;
	skippedPaths?: string[] | undefined;
	collisionPaths?: string[] | undefined;
	documentationRoot: string;
	profileId: string;
	isDryRun?: boolean | undefined;
}

export function buildGenerationReport(
	input: GenerationReportInput,
): TuiReportData {
	const groups: TuiReportGroup[] = [];

	// Created
	if (input.createdPaths && input.createdPaths.length > 0) {
		groups.push({
			items: input.createdPaths.map((p) => ({
				labelKind: 'current' as StateLabelKind,
				path: p,
				text: 'Created',
			})),
			label: 'Created',
			reason: `${input.createdPaths.length} file(s)`,
			severity: 'success',
		});
	}

	// Updated
	if (input.updatedPaths && input.updatedPaths.length > 0) {
		groups.push({
			items: input.updatedPaths.map((p) => ({
				labelKind: 'current' as StateLabelKind,
				path: p,
				text: 'Updated',
			})),
			label: 'Updated',
			reason: `${input.updatedPaths.length} file(s)`,
			severity: 'success',
		});
	}

	// Skipped
	if (input.skippedPaths && input.skippedPaths.length > 0) {
		groups.push({
			items: input.skippedPaths.map((p) => ({
				path: p,
				text: 'Skipped',
			})),
			label: 'Skipped',
			reason: `${input.skippedPaths.length} file(s)`,
			severity: 'info',
		});
	}

	// Collisions (manual edits protected)
	if (input.collisionPaths && input.collisionPaths.length > 0) {
		groups.push({
			items: input.collisionPaths.map((p) => ({
				labelKind: 'warning' as StateLabelKind,
				path: p,
				text: 'Collision (manual edits protected)',
			})),
			label: 'Collisions',
			reason: `${input.collisionPaths.length} file(s)`,
			severity: 'warning',
		});
	}

	// Blocked
	if (input.documentCounts.blocked > 0) {
		groups.push({
			items: [
				{
					labelKind: 'blocked' as StateLabelKind,
					text: `${input.documentCounts.blocked} document(s) blocked by unresolved dependencies`,
				},
			],
			label: 'Blocked',
			severity: 'warning',
		});
	}

	// Failed
	if (input.documentCounts.failed > 0) {
		groups.push({
			items: [
				{
					labelKind: 'failed' as StateLabelKind,
					text: `${input.documentCounts.failed} document(s) failed`,
				},
			],
			label: 'Failed',
			severity: 'error',
		});
	}

	// Stale
	if (input.documentCounts.stale > 0) {
		groups.push({
			items: [
				{
					labelKind: 'stale' as StateLabelKind,
					text: `${input.documentCounts.stale} document(s) are stale`,
				},
			],
			label: 'Stale',
			severity: 'info',
		});
	}

	// Incomplete
	if (input.documentCounts.incomplete > 0) {
		groups.push({
			items: [
				{
					labelKind: 'incomplete' as StateLabelKind,
					text: `${input.documentCounts.incomplete} document(s) incomplete`,
				},
			],
			label: 'Incomplete',
			severity: 'warning',
		});
	}

	const nextActions: string[] = [
		'Run /status to review updated state',
		'Run /diagnose for analysis',
	];

	if (input.collisionPaths && input.collisionPaths.length > 0) {
		nextActions.push(
			`${input.collisionPaths.length} file(s) had manual edits and were protected. Review manually or use --policy backup_and_write.',
		`,
		);
	}

	if (input.isDryRun) {
		nextActions.push('Run /generate --confirm to execute writes');
	}

	const hasIssues =
		input.documentCounts.blocked > 0 ||
		input.documentCounts.failed > 0 ||
		(input.collisionPaths?.length ?? 0) > 0;

	const statusLabel = hasIssues
		? stateLabelText('warning')
		: stateLabelText('ready');

	const total =
		input.documentCounts.generate +
		input.documentCounts.update +
		input.documentCounts.skip +
		input.documentCounts.stale;

	return buildReportData({
		groups,
		nextActions,
		outputType: 'canonical',
		summary: `Generation Report ${statusLabel} — ${total} document(s) processed. Root: ${input.documentationRoot}`,
	});
}

// ---------------------------------------------------------------------------
// Executive compile report
// ---------------------------------------------------------------------------

export interface ExecutiveCompileReportInput {
	ready: boolean;
	blockers: string[];
	warnings: string[];
	outputCount: number;
	exportTargets?: string[] | undefined;
	executiveRoot: string;
	isDryRun?: boolean | undefined;
}

export function buildExecutiveCompileReport(
	input: ExecutiveCompileReportInput,
): TuiReportData {
	const groups: TuiReportGroup[] = [];

	if (input.blockers.length > 0) {
		groups.push({
			items: input.blockers.map((b) => ({
				labelKind: 'blocked' as StateLabelKind,
				text: b,
			})),
			label: 'Blockers',
			reason: 'Must be resolved before compilation',
			severity: 'error',
		});
	}

	if (input.warnings.length > 0) {
		groups.push({
			items: input.warnings.map((w) => ({
				labelKind: 'warning' as StateLabelKind,
				text: w,
			})),
			label: 'Warnings',
			severity: 'warning',
		});
	}

	if (input.exportTargets && input.exportTargets.length > 0) {
		groups.push({
			items: input.exportTargets.map((t) => ({ text: t })),
			label: 'Export Targets',
			reason: `${input.outputCount} output(s)`,
			severity: 'info',
		});
	}

	const nextActions: string[] = [];
	if (!input.ready) {
		nextActions.push('Resolve blockers above before compiling.');
		nextActions.push('Run /diagnose to identify affected documents.');
	} else {
		nextActions.push(
			'Run /executive compile --confirm to execute compilation.',
		);
	}

	if (input.isDryRun) {
		nextActions.push('This was a dry-run. No files were written.');
	}

	const statusLabel = input.ready
		? stateLabelText('ready')
		: stateLabelText('blocked');

	return buildReportData({
		groups,
		nextActions,
		outputType: 'derived',
		summary: `Executive Compile Report ${statusLabel} — ${input.ready ? 'Ready' : 'Blocked'}. ${input.exportTargets?.length ?? 0} export target(s). Root: ${input.executiveRoot}`,
	});
}

// ---------------------------------------------------------------------------
// Provider config report
// ---------------------------------------------------------------------------

export interface ProviderConfigReportInput {
	status: string;
	providerId?: string | undefined;
	modelId?: string | undefined;
	endpointDisplay?: string | undefined;
	tokenEnvVar?: string | undefined;
	timeoutMs?: number | undefined;
	lastTestStatus?: string | undefined;
	disclosureStatus?: string | undefined;
	mode: string;
}

export function buildProviderConfigReport(
	input: ProviderConfigReportInput,
): TuiReportData {
	const items: TuiReportItem[] = [{ text: `Mode: ${input.mode}` }];

	if (input.providerId) {
		items.push({ text: `Provider: ${input.providerId}` });
	}
	if (input.modelId) {
		items.push({ text: `Model: ${input.modelId}` });
	}
	if (input.endpointDisplay) {
		items.push({ text: `Endpoint: ${input.endpointDisplay}` });
	}
	if (input.tokenEnvVar) {
		items.push({ text: `Token env var: $${input.tokenEnvVar} (configured)` });
	} else {
		items.push({ text: 'Token env var: (not set)' });
	}
	if (input.timeoutMs !== undefined) {
		items.push({
			text: `Timeout: ${input.timeoutMs}ms (${input.timeoutMs / 1000}s)`,
		});
	}
	if (input.disclosureStatus) {
		items.push({ text: `Disclosure: ${input.disclosureStatus}` });
	}
	if (input.lastTestStatus) {
		items.push({ text: `Last test: ${input.lastTestStatus}` });
	}

	const configStatus =
		input.mode === 'no_provider' || input.mode === 'disabled'
			? ('provider_unconfigured' as StateLabelKind)
			: input.lastTestStatus === 'success'
				? ('provider_ready' as StateLabelKind)
				: ('provider_disabled' as StateLabelKind);

	const groups: TuiReportGroup[] = [
		{
			items,
			label: 'Provider Configuration',
			severity: 'info',
		},
	];

	const nextActions: string[] = [];
	if (input.mode === 'no_provider' || input.mode === 'disabled') {
		nextActions.push('Run /config ai to set up a provider.');
	}
	nextActions.push('Run /config ai status for current configuration.');
	nextActions.push('Run /config ai test to test connectivity.');

	return buildReportData({
		groups,
		nextActions,
		outputType: 'report',
		summary: `Provider Configuration ${stateLabelText(configStatus)} — ${input.status}`,
	});
}

// ---------------------------------------------------------------------------
// Proposal report
// ---------------------------------------------------------------------------

export interface ProposalReportInput {
	proposals: Array<{
		id: string;
		title: string;
		kind: string;
		status: string;
		confidence?: string | undefined;
		sourceLabel?: string | undefined;
		affectedDocuments?: string[] | undefined;
	}>;
	totalCount: number;
}

export function buildProposalReport(input: ProposalReportInput): TuiReportData {
	const groups: TuiReportGroup[] = [];

	const byStatus = new Map<string, typeof input.proposals>();
	for (const p of input.proposals) {
		const list = byStatus.get(p.status) ?? [];
		list.push(p);
		byStatus.set(p.status, list);
	}

	for (const [status, proposals] of byStatus) {
		const statusLabelMap: Record<string, StateLabelKind> = {
			accepted: 'confirmed',
			confirmed: 'confirmed',
			defer: 'warning',
			deferred: 'warning',
			proposed: 'proposed',
			rejected: 'failed',
		};
		const labelKind = statusLabelMap[status] ?? 'unknown';

		groups.push({
			items: proposals.map((p) => ({
				detail: p.sourceLabel
					? `Source: ${p.sourceLabel}${p.confidence ? ` | Confidence: ${p.confidence}` : ''}`
					: undefined,
				labelKind: p.confidence === 'low' ? 'low_confidence' : labelKind,
				path: p.id,
				text: `[${p.kind}] ${p.title}`,
			})),
			label: `${status.charAt(0).toUpperCase() + status.slice(1)}`,
			reason: `${proposals.length} proposal(s)`,
			severity:
				status === 'accepted'
					? 'success'
					: status === 'rejected'
						? 'error'
						: 'info',
		});
	}

	const nextActions: string[] = [
		'Use /proposals show <id> to inspect a proposal.',
		'Use /proposals accept <id> to accept a proposal.',
		'Use /proposals reject <id> to reject a proposal.',
		'Use /proposals defer <id> to defer a proposal.',
	];

	return buildReportData({
		groups,
		nextActions,
		outputType: 'report',
		summary: `Proposal Review — ${input.totalCount} proposal(s).`,
	});
}

// ---------------------------------------------------------------------------
// Decision report
// ---------------------------------------------------------------------------

export interface DecisionReportInput {
	decisions: Array<{
		id: string;
		title: string;
		status: string;
		affectedDocuments?: string[] | undefined;
	}>;
	totalCount: number;
}

export function buildDecisionReport(input: DecisionReportInput): TuiReportData {
	const groups: TuiReportGroup[] = [];

	const byStatus = new Map<string, typeof input.decisions>();
	for (const d of input.decisions) {
		const list = byStatus.get(d.status) ?? [];
		list.push(d);
		byStatus.set(d.status, list);
	}

	for (const [status, decisions] of byStatus) {
		const statusLabelMap: Record<string, StateLabelKind> = {
			confirmed: 'confirmed',
			deprecated: 'stale',
			proposed: 'proposed',
			rejected: 'failed',
			superseded: 'stale',
		};
		const _labelKind = statusLabelMap[status] ?? 'unknown';

		groups.push({
			items: decisions.map((d) => ({
				detail: d.affectedDocuments
					? `Affects: ${d.affectedDocuments.slice(0, 5).join(', ')}`
					: undefined,
				path: d.id,
				text: d.title,
			})),
			label: `${status.charAt(0).toUpperCase() + status.slice(1)}`,
			reason: `${decisions.length} decision(s)`,
			severity: status === 'confirmed' ? 'success' : 'info',
		});
	}

	const nextActions: string[] = [
		'Use /decisions show <id> to inspect a decision.',
		'Use /decisions revise <id> <text> to correct a decision.',
		'Use /decisions affected <id> to see affected documents.',
	];

	return buildReportData({
		groups,
		nextActions,
		outputType: 'report',
		summary: `Decision Detail — ${input.totalCount} decision(s).`,
	});
}

// ---------------------------------------------------------------------------
// Recovery report
// ---------------------------------------------------------------------------

export interface RecoveryReportInput {
	/** The command or action that failed */
	command?: string | undefined;
	/** Error type classification */
	errorType: string;
	/** What failed */
	whatFailed: string;
	/** What was preserved */
	preservedState: string;
	/** What may be partial */
	partialState?: string | undefined;
	/** Recovery actions */
	recoveryActions: string[];
	/** Changed paths if any */
	changedPaths?: string[] | undefined;
	/** Whether retry is safe */
	retrySafe: boolean;
	/** Whether backup/restore exists */
	backupAvailable: boolean;
	/** Whether this was a dry-run */
	isDryRun?: boolean | undefined;
}

export function buildRecoveryReport(input: RecoveryReportInput): TuiReportData {
	const groups: TuiReportGroup[] = [];

	// What failed
	groups.push({
		items: [{ text: input.whatFailed }],
		label: 'Failure',
		reason: input.errorType,
		severity: 'error',
	});

	// Preserved state
	groups.push({
		items: [{ text: input.preservedState }],
		label: 'Preserved',
		severity: 'info',
	});

	if (input.partialState) {
		groups.push({
			items: [{ text: input.partialState }],
			label: 'Partial',
			reason: 'Some operations may have completed',
			severity: 'warning',
		});
	}

	// Changed paths
	if (input.changedPaths && input.changedPaths.length > 0) {
		groups.push({
			items: input.changedPaths.map((p) => ({ path: p, text: 'Changed' })),
			label: 'Changed Paths',
			reason: `${input.changedPaths.length} path(s)`,
			severity: 'info',
		});
	}

	const nextActions = [...input.recoveryActions];
	if (input.retrySafe) {
		nextActions.push('Retry is safe — run the command again.');
	}
	if (input.backupAvailable) {
		nextActions.push('Backup exists — run /restore if needed.');
	}

	return buildReportData({
		groups,
		nextActions,
		outputType: 'report',
		summary: `Recovery ${stateLabelText('failed')} — ${input.errorType}: ${input.whatFailed}`,
	});
}

// ---------------------------------------------------------------------------
// Large report truncation
// ---------------------------------------------------------------------------

/**
 * Truncate a report for safe display when it exceeds reasonable size.
 */
export function truncateReportForDisplay(
	report: TuiReportData,
	maxItems = 50,
): TuiReportData {
	let totalItems = 0;
	const truncatedGroups: TuiReportGroup[] = [];

	for (const group of report.groups) {
		if (totalItems >= maxItems) break;

		const remaining = maxItems - totalItems;
		const items = group.items.slice(0, remaining);
		totalItems += items.length;

		truncatedGroups.push({
			...group,
			items,
		});
	}

	if (totalItems < report.counts.total) {
		truncatedGroups.push({
			items: [
				{
					text: `... and ${report.counts.total - totalItems} more items truncated for display`,
				},
			],
			label: 'Truncated',
			severity: 'info',
		});
	}

	return buildReportData({
		groups: truncatedGroups,
		nextActions: report.nextActions,
		outputType: report.outputType,
		summary: report.summary,
	});
}
