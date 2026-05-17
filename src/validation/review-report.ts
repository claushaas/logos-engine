/** Step 6.3 — Review report artifact generation. Local non-canonical artifacts. */

import { createHash } from 'node:crypto';
import type {
	ValidationFinding,
	ValidationGateStatus,
	ValidationScope,
	ValidationSummary,
} from './validation-finding.js';

export type ValidationReportFormat = 'markdown' | 'json';

export type ValidationReportWritePolicy =
	| 'create_only'
	| 'backup_and_overwrite';

export type ValidationReportKind = 'validation' | 'diagnostic';

export interface ValidationReportArtifact {
	reportId: string;
	reportKind: ValidationReportKind;
	format: ValidationReportFormat;
	path: string;
	generatedAt: string;
	runId: string;
	checksum: string;
}

export interface ValidationReportParams {
	reportKind: ValidationReportKind;
	reportId: string;
	runId: string;
	generatedAt: string;
	title: string;
	projectRoot: string;
	documentationRoot: string;
	activeProfileId: string;
	scopesChecked: ValidationScope[];
	gateStatus: ValidationGateStatus;
	summary: ValidationSummary;
	findings: ValidationFinding[];
	diagnostics: string[];
	recoveryHints: string[];
	changedPaths: string[];
	dryRun: boolean;
	aiInterpretationSection?: string | undefined;
	aiInterpretationSource?: string | undefined;
}

export interface ValidationReportSummary {
	reportId: string;
	reportKind: ValidationReportKind;
	format: ValidationReportFormat;
	path: string;
	generatedAt: string;
	runId: string;
	gateStatus: ValidationGateStatus;
	totalFindings: number;
	changesPathHints: string[];
	checksum: string;
}

function severityLabel(severity: string): string {
	switch (severity) {
		case 'fatal':
			return 'FATAL';
		case 'error':
			return 'ERROR';
		case 'warning':
			return 'WARNING';
		case 'info':
			return 'INFO';
		default:
			return severity.toUpperCase();
	}
}

function gateLabel(status: ValidationGateStatus): string {
	switch (status) {
		case 'pass':
			return 'PASS';
		case 'pass_with_warnings':
			return 'PASS WITH WARNINGS';
		case 'fail':
			return 'FAIL';
	}
}

function escapeMarkdownTableCell(value: string): string {
	return value.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

export function renderValidationReportMarkdown(
	params: ValidationReportParams,
): string {
	const lines: string[] = [];

	lines.push(`# ${params.title}`);
	lines.push('');

	const reportType =
		params.reportKind === 'validation' ? 'Validation' : 'Diagnostic';
	lines.push(`**Report Type:** ${reportType}`);
	lines.push(`**Generated:** ${params.generatedAt}`);
	lines.push(`**Run ID:** ${params.runId}`);
	lines.push(`**Report ID:** ${params.reportId}`);
	lines.push(`**Project Root:** ${params.projectRoot}`);
	lines.push(`**Documentation Root:** ${params.documentationRoot}`);
	lines.push(`**Active Profile:** ${params.activeProfileId}`);
	lines.push(`**Scopes Checked:** ${params.scopesChecked.join(', ')}`);
	lines.push(`**Dry Run:** ${params.dryRun ? 'yes' : 'no'}`);
	lines.push('');

	lines.push('## Gate Status');
	lines.push('');
	lines.push(`**${gateLabel(params.gateStatus)}**`);
	lines.push('');

	lines.push('## Summary');
	lines.push('');
	lines.push(`- Total findings: ${params.summary.totalFindings}`);
	lines.push(`- Fatal: ${params.summary.bySeverity.fatal}`);
	lines.push(`- Errors: ${params.summary.bySeverity.error}`);
	lines.push(`- Warnings: ${params.summary.bySeverity.warning}`);
	lines.push(`- Info: ${params.summary.bySeverity.info}`);
	lines.push('');

	if (Object.keys(params.summary.bySource).length > 0) {
		lines.push('### By Source Kind');
		lines.push('');
		for (const [source, count] of Object.entries(params.summary.bySource)) {
			lines.push(`- ${source}: ${count}`);
		}
		lines.push('');
	}

	if (params.findings.length > 0) {
		lines.push('## Findings');
		lines.push('');
		lines.push(
			'| ID | Severity | Code | Source | Path | Pointer | Message | Recovery Hint |',
		);
		lines.push(
			'| -- | -------- | ---- | ------ | ---- | ------- | ------- | ------------- |',
		);

		for (const finding of params.findings) {
			const path = finding.location.path ?? '';
			const pointer = finding.location.pointer ?? '';
			const recovery = finding.recoveryHint?.message ?? '';
			lines.push(
				`| ${finding.id} | ${severityLabel(finding.severity)} | ${finding.code} | ${finding.source.kind} | ${escapeMarkdownTableCell(path)} | ${escapeMarkdownTableCell(pointer)} | ${escapeMarkdownTableCell(finding.message)} | ${escapeMarkdownTableCell(recovery)} |`,
			);
		}
		lines.push('');
	} else {
		lines.push('## Findings');
		lines.push('');
		lines.push('No findings.');
		lines.push('');
	}

	if (params.diagnostics.length > 0) {
		lines.push('## Diagnostics');
		lines.push('');
		for (const diag of params.diagnostics) {
			lines.push(`- ${diag}`);
		}
		lines.push('');
	}

	if (params.recoveryHints.length > 0) {
		lines.push('## Recovery Actions');
		lines.push('');
		for (const hint of params.recoveryHints) {
			lines.push(`- ${hint}`);
		}
		lines.push('');
	}

	if (params.changedPaths.length > 0) {
		lines.push('## Changed Paths');
		lines.push('');
		for (const p of params.changedPaths) {
			lines.push(`- ${p}`);
		}
		lines.push('');
	}

	if (params.aiInterpretationSection) {
		lines.push('## AI Interpretation');
		lines.push('');
		if (params.aiInterpretationSource) {
			lines.push(`**Source:** ${params.aiInterpretationSource}`);
			lines.push('');
		}
		lines.push(
			'> **Note:** AI interpretation is explanatory only. It does not alter deterministic severity, finding codes, or gate status.',
		);
		lines.push('');
		lines.push(params.aiInterpretationSection);
		lines.push('');
	}

	lines.push('---');
	lines.push('');
	if (params.reportKind === 'validation') {
		lines.push(
			'*Report generated by LOGOS Engine `/validate` command. Deterministic, AI-free validation. Review reports are non-canonical local artifacts.*',
		);
	} else {
		lines.push(
			'*Report generated by LOGOS Engine `/diagnose` command. Deterministic findings with optional explanatory AI interpretation. Review reports are non-canonical local artifacts.*',
		);
	}
	lines.push('');

	return lines.join('\n');
}

export function renderValidationReportJson(
	params: ValidationReportParams,
): string {
	const report = {
		activeProfileId: params.activeProfileId,
		changedPaths: params.changedPaths,
		diagnostics: params.diagnostics,
		documentationRoot: params.documentationRoot,
		dryRun: params.dryRun,
		findings: params.findings.map((f) => ({
			code: f.code,
			documentCanonicalId: f.documentCanonicalId,
			id: f.id,
			location: f.location,
			message: f.message,
			phaseId: f.phaseId,
			recoveryHint: f.recoveryHint,
			severity: f.severity,
			source: f.source,
		})),
		gateStatus: params.gateStatus,
		generatedAt: params.generatedAt,
		projectRoot: params.projectRoot,
		recoveryHints: params.recoveryHints,
		reportId: params.reportId,
		reportKind: params.reportKind,
		runId: params.runId,
		scopesChecked: params.scopesChecked,
		summary: params.summary,
		title: params.title,
	};

	if (params.aiInterpretationSection) {
		(report as Record<string, unknown>).aiInterpretation =
			params.aiInterpretationSection;
		(report as Record<string, unknown>).aiInterpretationSource =
			params.aiInterpretationSource;
		(report as Record<string, unknown>).aiInterpretationDisclaimer =
			'AI interpretation is explanatory only. It does not alter deterministic severity, finding codes, or gate status.';
	}

	return `${JSON.stringify(report, null, 2)}\n`;
}

export function computeReportChecksum(content: string): string {
	const hash = createHash('sha256');
	hash.update(content, 'utf-8');
	return hash.digest('hex');
}

export function planReportPath(params: {
	documentationRoot: string;
	projectRoot: string;
	reportKind: ValidationReportKind;
	runId: string;
	format: ValidationReportFormat;
}): { path: string; relativePath: string } {
	const docRoot = params.documentationRoot.endsWith('/')
		? params.documentationRoot
		: `${params.documentationRoot}/`;
	const ext = params.format === 'json' ? '.json' : '.md';
	const filename = `${params.reportKind}-${params.runId}${ext}`;
	const relativePath = `${docRoot}reports/${filename}`;
	return { path: relativePath, relativePath };
}

export function createReportSummary(params: {
	reportId: string;
	reportKind: ValidationReportKind;
	format: ValidationReportFormat;
	path: string;
	generatedAt: string;
	runId: string;
	gateStatus: ValidationGateStatus;
	totalFindings: number;
	changedPaths: string[];
	checksum: string;
}): ValidationReportSummary {
	return {
		changesPathHints: params.changedPaths,
		checksum: params.checksum,
		format: params.format,
		gateStatus: params.gateStatus,
		generatedAt: params.generatedAt,
		path: params.path,
		reportId: params.reportId,
		reportKind: params.reportKind,
		runId: params.runId,
		totalFindings: params.totalFindings,
	};
}
