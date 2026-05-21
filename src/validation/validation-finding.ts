/** Step 6.1 deterministic validation finding and result contracts. */

export type ValidationFindingSeverity = 'info' | 'warning' | 'error' | 'fatal';

export type ValidationGateStatus = 'pass' | 'pass_with_warnings' | 'fail';

export type ValidationScope =
	| 'contracts'
	| 'state'
	| 'artifacts'
	| 'outputs'
	| 'all';

export type ValidationFindingSource =
	| 'profile_registry'
	| 'phase_descriptor'
	| 'document_descriptor'
	| 'contract_graph'
	| 'workspace_state'
	| 'artifact_registry'
	| 'generated_output_metadata'
	| 'root_path'
	| 'secret_scan'
	| 'validation_service';

export type ValidationFindingCode =
	| 'profile_registry_missing'
	| 'profile_registry_invalid'
	| 'profile_path_invalid'
	| 'profile_lock_mismatch'
	| 'phase_descriptor_missing'
	| 'phase_descriptor_invalid'
	| 'phase_descriptor_malformed'
	| 'phase_duplicate_id'
	| 'document_descriptor_missing'
	| 'document_descriptor_invalid'
	| 'document_duplicate_id'
	| 'document_unknown_id'
	| 'document_invalid_status'
	| 'document_missing_dependency'
	| 'document_circular_dependency'
	| 'output_missing_canonical'
	| 'output_invalid_kind'
	| 'output_duplicate_path'
	| 'workspace_missing'
	| 'workspace_invalid_json'
	| 'workspace_schema_invalid'
	| 'workspace_schema_version_unsupported'
	| 'workspace_root_invalid'
	| 'workspace_reference_unknown'
	| 'artifact_invalid'
	| 'artifact_invalid_type'
	| 'artifact_invalid_status'
	| 'artifact_invalid_canonicality'
	| 'artifact_unknown_document'
	| 'artifact_unknown_phase'
	| 'artifact_path_invalid'
	| 'artifact_duplicate_path'
	| 'artifact_checksum_invalid'
	| 'artifact_generated_at_invalid'
	| 'artifact_file_missing'
	| 'output_metadata_missing'
	| 'output_metadata_invalid'
	| 'output_metadata_document_mismatch'
	| 'output_metadata_phase_mismatch'
	| 'output_metadata_profile_mismatch'
	| 'output_metadata_path_mismatch'
	| 'output_metadata_validation_overclaim'
	| 'output_manual_edit_status'
	| 'output_registry_mismatch'
	| 'root_invalid'
	| 'path_traversal'
	| 'secret_like_value'
	| 'validation_scope_failed'
	| (string & {});

export interface ValidationFindingLocation {
	path?: string | undefined;
	pointer?: string | undefined;
}

export interface ValidationFindingRecoveryHint {
	message: string;
	action?: string | undefined;
}

export interface ValidationDiagnostic {
	code: string;
	severity: ValidationFindingSeverity;
	message: string;
	scope?: ValidationScope | undefined;
	source?: ValidationFindingSource | undefined;
	path?: string | undefined;
}

export interface ValidationTarget {
	profileId?: string | undefined;
	projectRoot?: string | undefined;
	workspacePath?: string | undefined;
	documentationRoot?: string | undefined;
	profileRoot?: string | undefined;
}

export interface ValidationFinding {
	id: string;
	code: ValidationFindingCode;
	severity: ValidationFindingSeverity;
	message: string;
	source: {
		kind: ValidationFindingSource;
		path?: string | undefined;
	};
	location: ValidationFindingLocation;
	documentCanonicalId?: string | undefined;
	phaseId?: string | undefined;
	workspaceRecordId?: string | undefined;
	expected?: unknown;
	received?: unknown;
	recoveryHint?: ValidationFindingRecoveryHint | undefined;
	order: number;
}

export interface ValidationSummary {
	totalFindings: number;
	bySeverity: Record<ValidationFindingSeverity, number>;
	bySource: Partial<Record<ValidationFindingSource, number>>;
}

export interface ValidationRunInput extends ValidationTarget {
	scopes?: ValidationScope[] | undefined;
	state?: unknown;
	artifacts?: unknown[] | undefined;
	outputPaths?: string[] | undefined;
}

export interface ValidationRunOptions {
	scopes?: ValidationScope[] | undefined;
	dryRun?: boolean | undefined;
	includeInfo?: boolean | undefined;
	allowInfoFindingsToPass?: boolean | undefined;
}

export interface ValidationRunResult {
	status: ValidationGateStatus;
	summary: ValidationSummary;
	findings: ValidationFinding[];
	validatedProfileId?: string | undefined;
	projectRoot?: string | undefined;
	workspacePath?: string | undefined;
	documentationRoot?: string | undefined;
	scopesChecked: ValidationScope[];
	diagnostics: ValidationDiagnostic[];
	dryRun: boolean;
	readOnly: true;
	changedPaths: [];
}

const severityOrder: Record<ValidationFindingSeverity, number> = {
	error: 1,
	fatal: 0,
	info: 3,
	warning: 2,
};

const sourceOrder: Record<ValidationFindingSource, number> = {
	artifact_registry: 5,
	contract_graph: 3,
	document_descriptor: 2,
	generated_output_metadata: 6,
	phase_descriptor: 1,
	profile_registry: 0,
	root_path: 7,
	secret_scan: 8,
	validation_service: 9,
	workspace_state: 4,
};

export const VALIDATION_FINDING_SORT_ORDER = [
	'severity',
	'source.kind',
	'source.path',
	'location.pointer',
	'documentCanonicalId',
	'code',
	'order',
] as const;

export function redactValidationValue(value: unknown): unknown {
	if (typeof value === 'string') {
		return redactSecretLikeString(value);
	}
	if (Array.isArray(value)) return value.map(redactValidationValue);
	if (value !== null && typeof value === 'object') {
		const redacted: Record<string, unknown> = {};
		for (const [key, item] of Object.entries(value)) {
			redacted[key] = redactValidationValue(item);
		}
		return redacted;
	}
	return value;
}

export function looksLikeSecretLikeValue(value: unknown): boolean {
	if (typeof value !== 'string') return false;
	const lower = value.toLowerCase();
	if (lower.startsWith('sk-')) return true;
	if (lower.startsWith('sk_')) return true;
	if (lower.startsWith('bearer ')) return true;
	if (lower.startsWith('basic ')) return true;
	if (lower.startsWith('api-')) return true;
	if (lower.startsWith('api_')) return true;
	if (/^(ghp|gho|ghu|ghs|ghr|xoxb|xoxp|dapi|sl|AKIA)/.test(value)) {
		return true;
	}
	return (
		value.length > 40 &&
		!value.includes('_') &&
		/[a-zA-Z0-9+/]{30,}/.test(value)
	);
}

export function redactSecretLikeString(value: string): string {
	if (!looksLikeSecretLikeValue(value)) return value;
	return '[redacted-secret-like-value]';
}

export function createValidationFinding(
	finding: Omit<ValidationFinding, 'id'> & { id?: string | undefined },
): ValidationFinding {
	const sourcePath = finding.source.path ?? '';
	const pointer = finding.location.pointer ?? '';
	const documentId = finding.documentCanonicalId ?? '';
	const phaseId = finding.phaseId ?? '';
	const workspaceRecordId = finding.workspaceRecordId ?? '';
	const id =
		finding.id ??
		[
			finding.code,
			finding.severity,
			finding.source.kind,
			sourcePath,
			pointer,
			documentId,
			phaseId,
			workspaceRecordId,
		].join('|');

	return {
		...finding,
		expected: redactValidationValue(finding.expected),
		id,
		received: redactValidationValue(finding.received),
	};
}

export function sortValidationFindings(
	findings: ValidationFinding[],
): ValidationFinding[] {
	return [...findings]
		.sort((a, b) => {
			const severity = severityOrder[a.severity] - severityOrder[b.severity];
			if (severity !== 0) return severity;
			const source = sourceOrder[a.source.kind] - sourceOrder[b.source.kind];
			if (source !== 0) return source;
			const sourcePath = (a.source.path ?? '').localeCompare(
				b.source.path ?? '',
			);
			if (sourcePath !== 0) return sourcePath;
			const pointer = (a.location.pointer ?? '').localeCompare(
				b.location.pointer ?? '',
			);
			if (pointer !== 0) return pointer;
			const doc = (a.documentCanonicalId ?? '').localeCompare(
				b.documentCanonicalId ?? '',
			);
			if (doc !== 0) return doc;
			const code = a.code.localeCompare(b.code);
			if (code !== 0) return code;
			return a.order - b.order;
		})
		.map((finding, index) => ({ ...finding, order: index }));
}

export function determineValidationGateStatus(
	findings: ValidationFinding[],
	options: Pick<ValidationRunOptions, 'allowInfoFindingsToPass'> = {},
): ValidationGateStatus {
	if (findings.some((f) => f.severity === 'fatal' || f.severity === 'error')) {
		return 'fail';
	}
	if (findings.some((f) => f.severity === 'warning')) {
		return 'pass_with_warnings';
	}
	if (findings.some((f) => f.severity === 'info')) {
		return options.allowInfoFindingsToPass === false
			? 'pass_with_warnings'
			: 'pass';
	}
	return 'pass';
}

export function summarizeValidationFindings(
	findings: ValidationFinding[],
): ValidationSummary {
	const bySeverity: Record<ValidationFindingSeverity, number> = {
		error: 0,
		fatal: 0,
		info: 0,
		warning: 0,
	};
	const bySource: Partial<Record<ValidationFindingSource, number>> = {};
	for (const finding of findings) {
		bySeverity[finding.severity] += 1;
		bySource[finding.source.kind] = (bySource[finding.source.kind] ?? 0) + 1;
	}
	return { bySeverity, bySource, totalFindings: findings.length };
}

export function createValidationRunResult(params: {
	findings: ValidationFinding[];
	scopesChecked: ValidationScope[];
	diagnostics?: ValidationDiagnostic[] | undefined;
	validatedProfileId?: string | undefined;
	projectRoot?: string | undefined;
	workspacePath?: string | undefined;
	documentationRoot?: string | undefined;
	dryRun?: boolean | undefined;
	allowInfoFindingsToPass?: boolean | undefined;
}): ValidationRunResult {
	const findings = sortValidationFindings(params.findings);
	return {
		changedPaths: [],
		diagnostics: params.diagnostics ?? [],
		documentationRoot: params.documentationRoot,
		dryRun: params.dryRun ?? true,
		findings,
		projectRoot: params.projectRoot,
		readOnly: true,
		scopesChecked: params.scopesChecked,
		status: determineValidationGateStatus(findings, {
			allowInfoFindingsToPass: params.allowInfoFindingsToPass,
		}),
		summary: summarizeValidationFindings(findings),
		validatedProfileId: params.validatedProfileId,
		workspacePath: params.workspacePath,
	};
}
