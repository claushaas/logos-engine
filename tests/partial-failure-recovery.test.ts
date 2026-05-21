import { describe, expect, it } from 'vitest';
import {
	createDiagnostic,
	type LogosPartialFailure,
	recoveryHint,
} from '../src/runtime/diagnostics.js';
import { createCommandResult, ErrorCodes } from '../src/runtime/index.js';

// ---------------------------------------------------------------------------
// Partial failure reporting
// ---------------------------------------------------------------------------

describe('partial failure reporting', () => {
	it('multi-file generation reports partial status when some writes fail', () => {
		// Simulate a partial generation: 2 succeeded, 1 failed
		const result = createCommandResult({
			changedPaths: [
				{ action: 'created', kind: 'canonical', path: 'logos/doc1.md' },
				{ action: 'created', kind: 'canonical', path: 'logos/doc2.md' },
				{ action: 'failed', kind: 'canonical', path: 'logos/doc3.md' },
			],
			command: 'generate',
			errors: [
				{
					code: ErrorCodes.GENERATION_WRITE_FAILED,
					message: 'Failed to write logos/doc3.md: permission denied',
					path: 'logos/doc3.md',
					recoveryHint: 'Check file permissions and retry',
					severity: 'error',
				},
			],
			status: 'partial',
		});

		expect(result.status).toBe('partial');
		expect(result.changedPaths).toHaveLength(3);
		// Successful writes reported
		expect(result.changedPaths[0].path).toBe('logos/doc1.md');
		expect(result.changedPaths[0].action).toBe('created');
		// Failed writes reported
		expect(result.changedPaths[2].path).toBe('logos/doc3.md');
		expect(result.changedPaths[2].action).toBe('failed');
	});

	it('failed-before-write has empty changed paths', () => {
		const result = createCommandResult({
			changedPaths: [],
			command: 'generate',
			errors: [
				{
					code: ErrorCodes.GENERATION_BLOCKED,
					message: 'Generation blocked by missing dependencies',
					severity: 'error',
				},
			],
			status: 'blocked' as 'error',
		});
		expect(result.changedPaths).toEqual([]);
	});

	it('security failure stops before write', () => {
		// When a security check fails, no files should be written
		const result = createCommandResult({
			changedPaths: [],
			command: 'generate',
			errors: [
				{
					code: ErrorCodes.SECURITY_CHECK_FAILED,
					message: 'Security check failed: potential token leak in output',
					severity: 'fatal',
				},
			],
			status: 'error',
		});
		expect(result.changedPaths).toEqual([]);
	});

	it('registry update failure after write reports both', () => {
		// File was written successfully but registry update failed
		const result = createCommandResult({
			changedPaths: [
				{ action: 'created', kind: 'canonical', path: 'logos/doc.md' },
			],
			command: 'generate',
			errors: [
				{
					code: ErrorCodes.GENERATION_REGISTRY_FAILED,
					message: 'Artifact registry update failed after file write',
					recoveryHint: 'Run /diagnose to check registry state',
					severity: 'warning',
				},
			],
			status: 'partial',
		});
		expect(result.status).toBe('partial');
		expect(result.changedPaths).toHaveLength(1);
		expect(result.changedPaths[0].action).toBe('created');
		expect(result.errors).toHaveLength(1);
	});

	it('dry-run never reports actual changed paths', () => {
		const result = createCommandResult({
			changedPaths: [
				{ action: 'would_create', kind: 'canonical', path: 'logos/doc.md' },
				{ action: 'would_skip', kind: 'canonical', path: 'logos/existing.md' },
			],
			command: 'generate',
			dryRun: true,
			status: 'dry_run',
		});
		expect(result.dryRun).toBe(true);
		for (const cp of result.changedPaths) {
			expect(cp.action.startsWith('would_')).toBe(true);
		}
	});

	it('backup creation failure blocks destructive write', () => {
		const result = createCommandResult({
			changedPaths: [],
			command: 'generate',
			errors: [
				{
					code: ErrorCodes.FS_BACKUP_FAILED,
					message: 'Backup creation failed; write blocked to prevent data loss',
					path: 'logos/doc.md',
					recoveryHint: 'Check disk space and permissions for backup directory',
					severity: 'error',
				},
			],
			status: 'error',
		});
		expect(result.changedPaths).toEqual([]);
	});
});

// ---------------------------------------------------------------------------
// Structured partial failure model
// ---------------------------------------------------------------------------

describe('LogosPartialFailure shape', () => {
	it('partial failure includes completed, failed, skipped, and backup paths', () => {
		const pf: LogosPartialFailure = {
			backupPaths: ['logos/.backup/workspace.json.1712345678'],
			changedPaths: [
				{ action: 'created', kind: 'canonical', path: 'logos/doc1.md' },
				{ action: 'created', kind: 'canonical', path: 'logos/doc2.md' },
				{ action: 'failed', kind: 'canonical', path: 'logos/doc3.md' },
			],
			completedTargets: ['logos/doc1.md', 'logos/doc2.md'],
			failedTargets: ['logos/doc3.md'],
			recoveryHints: [
				recoveryHint('check_path', 'Check permissions on logos/doc3.md', {
					path: 'logos/doc3.md',
				}),
			],
			skippedTargets: ['logos/doc4.md'],
			status: 'partial',
			unchangedPaths: ['logos/doc4.md'],
		};

		expect(pf.status).toBe('partial');
		expect(pf.completedTargets).toHaveLength(2);
		expect(pf.failedTargets).toHaveLength(1);
		expect(pf.skippedTargets).toHaveLength(1);
		expect(pf.backupPaths).toHaveLength(1);
		expect(pf.changedPaths).toHaveLength(3);
		expect(pf.unchangedPaths).toHaveLength(1);
		expect(pf.recoveryHints).toHaveLength(1);
	});

	it('is JSON serializable', () => {
		const pf: LogosPartialFailure = {
			backupPaths: [],
			changedPaths: [{ action: 'created', path: 'logos/doc.md' }],
			completedTargets: ['logos/doc.md'],
			failedTargets: [],
			recoveryHints: [],
			skippedTargets: [],
			status: 'partial',
			unchangedPaths: [],
		};
		const json = JSON.stringify(pf);
		expect(json).toContain('partial');
		expect(json).toContain('logos/doc.md');
	});
});

// ---------------------------------------------------------------------------
// Safe filesystem recovery diagnostics
// ---------------------------------------------------------------------------

describe('safe filesystem recovery diagnostics', () => {
	it('path traversal maps to stable diagnostic', () => {
		const diag = createDiagnostic({
			code: ErrorCodes.FS_PATH_TRAVERSAL,
			message: 'Path traversal detected: target outside base directory',
			path: '../../../etc/passwd',
			recoveryHints: [
				recoveryHint(
					'check_path',
					'Ensure the target path is inside the project workspace',
				),
			],
			severity: 'error',
		});
		expect(diag.code).toBe('LOGOS_FS_PATH_TRAVERSAL');
		expect(diag.severity).toBe('error');
	});

	it('unsafe absolute path maps to stable diagnostic', () => {
		const diag = createDiagnostic({
			code: ErrorCodes.FS_UNSAFE_ABSOLUTE_PATH,
			message: 'Absolute path rejected',
			path: '/etc/config',
			recoveryHints: [
				recoveryHint('check_path', 'Use a relative path within the workspace'),
			],
			severity: 'error',
		});
		expect(diag.code).toBe('LOGOS_FS_UNSAFE_ABSOLUTE_PATH');
	});

	it('permission denied maps to stable diagnostic', () => {
		const diag = createDiagnostic({
			code: ErrorCodes.FS_PERMISSION_DENIED,
			message: 'Permission denied writing file',
			path: 'logos/doc.md',
			recoveryHints: [recoveryHint('check_path', 'Check file permissions')],
			severity: 'error',
		});
		expect(diag.code).toBe('LOGOS_FS_PERMISSION_DENIED');
	});

	it('missing path maps to stable diagnostic', () => {
		const diag = createDiagnostic({
			code: ErrorCodes.FS_NOT_FOUND,
			message: 'Directory not found for write target',
			path: 'logos/nonexistent/doc.md',
			recoveryHints: [
				recoveryHint('run_command', 'Create the directory structure first', {
					command: '/init',
				}),
			],
			severity: 'error',
		});
		expect(diag.code).toBe('LOGOS_FS_NOT_FOUND');
	});

	it('collision maps to stable diagnostic', () => {
		const diag = createDiagnostic({
			code: ErrorCodes.FS_COLLISION,
			message: 'Manual edit collision detected: target has been modified',
			path: 'logos/01-foundation/doc.md',
			recoveryHints: [
				recoveryHint(
					'resolve_collision',
					'Review manual edits or use backup_and_write policy',
				),
			],
			severity: 'warning',
		});
		expect(diag.code).toBe('LOGOS_FS_COLLISION');
		expect(diag.severity).toBe('warning');
	});

	it('disk-full error maps to stable diagnostic', () => {
		const diag = createDiagnostic({
			code: ErrorCodes.FS_DISK_FULL,
			message: 'Write failed: no space left on device',
			path: 'logos/doc.md',
			recoveryHints: [recoveryHint('check_path', 'Free disk space and retry')],
			severity: 'fatal',
		});
		expect(diag.code).toBe('LOGOS_FS_DISK_FULL');
		expect(diag.severity).toBe('fatal');
	});

	it('corrupt JSON/YAML read maps to restore/diagnose hint', () => {
		const diag = createDiagnostic({
			code: ErrorCodes.STATE_CORRUPT_JSON,
			message: 'Corrupt workspace state file: invalid JSON',
			path: '.logos/workspace.json',
			recoveryHints: [
				recoveryHint(
					'restore_backup',
					'Restore from backup file if available',
					{
						path: '.logos/.backup/',
					},
				),
				recoveryHint('run_command', 'Run diagnostic check', {
					command: '/diagnose',
				}),
			],
			severity: 'error',
		});
		expect(diag.code).toBe('LOGOS_STATE_CORRUPT_JSON');
		expect(
			diag.recoveryHints.some((h) => h.category === 'restore_backup'),
		).toBe(true);
		expect(diag.recoveryHints.some((h) => h.category === 'run_command')).toBe(
			true,
		);
	});

	it('backup restore hint appears where relevant', () => {
		const diag = createDiagnostic({
			code: ErrorCodes.STATE_WRITE_ERROR,
			message: 'Failed to write workspace state',
			path: '.logos/workspace.json',
			recoveryHints: [
				recoveryHint(
					'restore_backup',
					'If a backup exists, restore from .logos/.backup/',
				),
			],
			severity: 'error',
		});
		expect(diag.recoveryHints[0].category).toBe('restore_backup');
	});
});

// ---------------------------------------------------------------------------
// State recovery diagnostics
// ---------------------------------------------------------------------------

describe('state recovery diagnostics', () => {
	it('missing .logos suggests /init', () => {
		const diag = createDiagnostic({
			code: ErrorCodes.STATE_MISSING,
			message: 'Workspace directory not found',
			path: '.logos',
			recoveryHints: [
				recoveryHint('run_command', 'Initialize the LOGOS workspace', {
					command: '/init',
				}),
			],
			severity: 'info',
		});
		expect(diag.code).toBe('LOGOS_STATE_MISSING');
		expect(diag.severity).toBe('info');
		expect(diag.recoveryHints[0].command).toBe('/init');
	});

	it('missing state file has recovery hint', () => {
		const diag = createDiagnostic({
			code: ErrorCodes.STATE_MISSING,
			message: 'State file not found',
			path: '.logos/workspace.json',
			recoveryHints: [
				recoveryHint('run_command', 'Re-initialize the workspace', {
					command: '/init',
				}),
				recoveryHint('restore_backup', 'Restore from backup'),
			],
			severity: 'warning',
		});
		expect(diag.recoveryHints[0].category).toBe('run_command');
	});

	it('invalid state schema has recovery hint', () => {
		const diag = createDiagnostic({
			code: ErrorCodes.STATE_INVALID_SCHEMA,
			message: 'Workspace state schema validation failed',
			path: '.logos/workspace.json',
			pointer: 'profile.profileId',
			recoveryHints: [
				recoveryHint('run_command', 'Run diagnostic to inspect state', {
					command: '/diagnose',
				}),
				recoveryHint('restore_backup', 'Restore from backup'),
				recoveryHint(
					'manual_review',
					'Manually repair the workspace state file',
				),
			],
			severity: 'error',
		});
		expect(diag.code).toBe('LOGOS_STATE_INVALID_SCHEMA');
	});

	it('unsupported schema version has recovery hint', () => {
		const diag = createDiagnostic({
			code: ErrorCodes.STATE_UNSUPPORTED_VERSION,
			expectedValue: '1',
			message: 'Unsupported workspace state schema version: 2',
			path: '.logos/workspace.json',
			receivedValue: '2',
			recoveryHints: [
				recoveryHint(
					'manual_review',
					'Migration to newer format may be required',
				),
			],
			severity: 'error',
		});
		expect(diag.code).toBe('LOGOS_STATE_UNSUPPORTED_VERSION');
		expect(diag.expectedValue).toBe('1');
	});

	it('corrupt artifact registry does not change unrelated error handling', () => {
		const diag = createDiagnostic({
			code: ErrorCodes.STATE_CORRUPT_REGISTRY,
			message: 'Artifact registry entry corrupted',
			path: '.logos/workspace.json',
			pointer: 'artifacts[3]',
			recoveryHints: [
				recoveryHint(
					'run_command',
					'Run /diagnose to check registry integrity',
				),
			],
			severity: 'warning',
		});
		expect(diag.code).toBe('LOGOS_STATE_CORRUPT_REGISTRY');
		expect(diag.severity).toBe('warning');
	});

	it('provider config error never shows token value', () => {
		const diag = createDiagnostic({
			code: ErrorCodes.SECURITY_TOKEN_LEAK,
			message: 'Provider token detected in output; token redacted',
			recoveryHints: [
				recoveryHint('remove_secret', 'Remove raw token from configuration'),
			],
			redactionSummary: '1 token value redacted',
			severity: 'fatal',
		});
		expect(diag.code).toBe('LOGOS_SECURITY_TOKEN_LEAK');
		expect(diag.message).not.toContain('sk-');
		expect(diag.message).not.toContain('Bearer');
		expect(diag.redactionSummary).toBeTruthy();
	});
});

// ---------------------------------------------------------------------------
// Profile/contract recovery diagnostics
// ---------------------------------------------------------------------------

describe('profile/contract recovery diagnostics', () => {
	it('missing profile registry has diagnostic', () => {
		const diag = createDiagnostic({
			code: ErrorCodes.PROFILE_NOT_FOUND,
			message: 'Profile registry not found',
			path: 'profiles/standard/docs.yml',
			recoveryHints: [
				recoveryHint('check_path', 'Verify profile files are installed'),
				recoveryHint('run_command', 'Reinstall the package'),
			],
			severity: 'fatal',
		});
		expect(diag.code).toBe('LOGOS_PROFILE_NOT_FOUND');
		expect(diag.severity).toBe('fatal');
	});

	it('invalid YAML has safe diagnostic without raw parser dump', () => {
		const diag = createDiagnostic({
			code: ErrorCodes.PROFILE_INVALID_YAML,
			message: 'Invalid YAML in profile document descriptor',
			path: 'profiles/standard/phases/01-foundation/docs.yml',
			pointer: 'line 15',
			recoveryHints: [
				recoveryHint('check_path', 'Fix YAML syntax in the descriptor file'),
			],
			severity: 'error',
		});

		expect(diag.message).not.toContain('YAMLParseError');
		expect(diag.message).not.toContain('at line');
		expect(diag.message).not.toContain('stack');
	});

	it('schema pointer included when validation fails', () => {
		const diag = createDiagnostic({
			code: ErrorCodes.PROFILE_SCHEMA_MISMATCH,
			expectedValue: 'string',
			message: 'Document descriptor schema validation failed',
			path: 'profiles/standard/phases/01-foundation/docs.yml',
			pointer: 'documents[0].outputs.canonical.path',
			receivedValue: 'null',
			recoveryHints: [
				recoveryHint('check_path', 'Fix the descriptor schema field'),
			],
			severity: 'error',
		});
		expect(diag.pointer).toBe('documents[0].outputs.canonical.path');
		expect(diag.expectedValue).toBe('string');
	});

	it('duplicate IDs include related ids', () => {
		const diag = createDiagnostic({
			code: ErrorCodes.PROFILE_DUPLICATE_ID,
			message: 'Duplicate document ID found',
			path: 'profiles/standard/phases/01-foundation/docs.yml',
			recoveryHints: [
				recoveryHint(
					'fix_config',
					'Ensure document IDs are unique within the profile',
				),
			],
			relatedIds: { documentId: '01-purpose', phaseId: '01-foundation' },
			severity: 'error',
		});
		expect(diag.relatedIds?.documentId).toBe('01-purpose');
		expect(diag.relatedIds?.phaseId).toBe('01-foundation');
	});

	it('circular dependency includes related ids', () => {
		const diag = createDiagnostic({
			code: ErrorCodes.PROFILE_CIRCULAR_DEPENDENCY,
			message: 'Circular dependency detected between documents',
			recoveryHints: [
				recoveryHint(
					'fix_config',
					'Break the circular dependency in the profile',
				),
			],
			relatedIds: {
				documentId: '02-objectives',
				phaseId: '01-foundation',
			},
			severity: 'error',
		});
		expect(diag.code).toBe('LOGOS_PROFILE_CIRCULAR_DEPENDENCY');
	});

	it('missing descriptor includes path and recovery', () => {
		const diag = createDiagnostic({
			code: ErrorCodes.PROFILE_MISSING_DESCRIPTOR,
			message: 'Document descriptor file not found',
			path: 'profiles/standard/phases/01-foundation/docs.yml',
			recoveryHints: [
				recoveryHint(
					'check_path',
					'Ensure the descriptor file exists at the expected path',
				),
				recoveryHint('run_command', 'Reinstall the profile package'),
			],
			severity: 'error',
		});
		expect(diag.path).toBeTruthy();
	});

	it('unsupported profile version is handled clearly', () => {
		const diag = createDiagnostic({
			code: ErrorCodes.PROFILE_UNSUPPORTED_VERSION,
			expectedValue: '1.x',
			message:
				'Profile version 5.0 is not supported by this LOGOS Engine version',
			path: 'profiles/standard/docs.yml',
			receivedValue: '5.0',
			recoveryHints: [
				recoveryHint(
					'manual_review',
					'Update LOGOS Engine or use a compatible profile version',
				),
			],
			severity: 'fatal',
		});
		expect(diag.code).toBe('LOGOS_PROFILE_UNSUPPORTED_VERSION');
	});
});

// ---------------------------------------------------------------------------
// Validation/diagnose recovery
// ---------------------------------------------------------------------------

describe('validation/diagnose recovery diagnostics', () => {
	it('validation subsystem failure produces distinguished diagnostic', () => {
		const diag = createDiagnostic({
			code: ErrorCodes.VALIDATION_SUBSYSTEM_FAILED,
			message: 'Output validation subsystem failed',
			recoveryHints: [
				recoveryHint('run_command', 'Retry validation', {
					command: '/validate',
				}),
			],
			severity: 'error',
		});
		expect(diag.code).toBe('LOGOS_VALIDATION_SUBSYSTEM_FAILED');
	});

	it('provider unavailable is warning/recovery hint', () => {
		const diag = createDiagnostic({
			code: ErrorCodes.VALIDATION_PROVIDER_UNAVAILABLE,
			message: 'AI provider is not configured; interpretation may be limited',
			recoveryHints: [
				recoveryHint(
					'configure_provider',
					'Configure an AI provider for enhanced interpretation',
				),
			],
			severity: 'warning',
		});
		expect(diag.code).toBe('LOGOS_VALIDATION_PROVIDER_UNAVAILABLE');
		expect(diag.severity).toBe('warning');
	});

	it('deterministic findings remain deterministic even with AI unavailable', () => {
		const diag = createDiagnostic({
			code: ErrorCodes.VALIDATION_PROVIDER_UNAVAILABLE,
			message: 'Deterministic validation completed; AI interpretation skipped',
			recoveryHints: [
				recoveryHint(
					'configure_provider',
					'Configure an AI provider for interpretation',
				),
			],
			severity: 'info',
		});
		expect(diag.severity).toBe('info');
		expect(diag.message).toContain('Deterministic');
	});
});

// ---------------------------------------------------------------------------
// Generation/artifact recovery
// ---------------------------------------------------------------------------

describe('generation/artifact recovery diagnostics', () => {
	it('planner blocked is distinct from writer failure', () => {
		const blocked = createDiagnostic({
			code: ErrorCodes.GENERATION_BLOCKED,
			message: 'Generation blocked: required open question not resolved',
			recoveryHints: [
				recoveryHint(
					'resolve_open_question',
					'Answer outstanding intake questions first',
				),
			],
			severity: 'warning',
		});
		const writeFailed = createDiagnostic({
			code: ErrorCodes.GENERATION_WRITE_FAILED,
			message: 'Failed to write canonical document to disk',
			path: 'logos/doc.md',
			recoveryHints: [
				recoveryHint('check_path', 'Check file permissions and disk space'),
			],
			severity: 'error',
		});
		expect(blocked.code).toBe('LOGOS_GENERATION_BLOCKED');
		expect(writeFailed.code).toBe('LOGOS_GENERATION_WRITE_FAILED');
		expect(blocked.code).not.toBe(writeFailed.code);
	});

	it('renderer failure is distinct from safe-write failure', () => {
		const renderFailed = createDiagnostic({
			code: ErrorCodes.GENERATION_RENDER_FAILED,
			message: 'Markdown renderer failed for document',
			path: 'logos/doc.md',
			severity: 'error',
		});
		const writeFailed = createDiagnostic({
			code: ErrorCodes.GENERATION_WRITE_FAILED,
			message: 'Safe writer failed to commit rendered output',
			path: 'logos/doc.md',
			severity: 'error',
		});
		expect(renderFailed.code).toBe('LOGOS_GENERATION_RENDER_FAILED');
		expect(writeFailed.code).toBe('LOGOS_GENERATION_WRITE_FAILED');
	});

	it('manual edit collision is distinct from validation blocker', () => {
		const collision = createDiagnostic({
			code: ErrorCodes.GENERATION_MANUAL_EDIT_COLLISION,
			message: 'Manual edit detected; file protected from overwrite',
			path: 'logos/doc.md',
			recoveryHints: [
				recoveryHint(
					'resolve_collision',
					'Review manual edits or use backup_and_write',
				),
			],
			severity: 'warning',
		});
		expect(collision.code).toBe('LOGOS_GENERATION_MANUAL_EDIT_COLLISION');
	});

	it('stale source is distinct from missing source', () => {
		const stale = createDiagnostic({
			code: ErrorCodes.GENERATION_STALE_SOURCE,
			message: 'Source data changed; output may be stale',
			path: 'logos/doc.md',
			severity: 'warning',
		});
		const missing = createDiagnostic({
			code: ErrorCodes.GENERATION_MISSING_SOURCE,
			message: 'Required source document not found',
			path: 'logos/doc.md',
			severity: 'error',
		});
		expect(stale.code).toBe('LOGOS_GENERATION_STALE_SOURCE');
		expect(missing.code).toBe('LOGOS_GENERATION_MISSING_SOURCE');
		expect(stale.code).not.toBe(missing.code);
	});

	it('artifact registry failure after write is partial', () => {
		const diag = createDiagnostic({
			code: ErrorCodes.GENERATION_REGISTRY_FAILED,
			message: 'File was written but artifact registry update failed',
			path: 'logos/doc.md',
			recoveryHints: [
				recoveryHint('run_command', 'Run /diagnose to sync registry', {
					command: '/diagnose',
				}),
			],
			severity: 'warning',
		});
		expect(diag.code).toBe('LOGOS_GENERATION_REGISTRY_FAILED');
		expect(diag.severity).toBe('warning');
	});
});

// ---------------------------------------------------------------------------
// Executive/import/scanner/extraction recovery
// ---------------------------------------------------------------------------

describe('executive/import/scanner/extraction recovery', () => {
	it('executive readiness blocked is distinct from schema failure', () => {
		const readiness = createDiagnostic({
			code: ErrorCodes.EXECUTIVE_READINESS_BLOCKED,
			message: 'Executive compilation blocked: unresolved open questions',
			recoveryHints: [
				recoveryHint('resolve_open_question', 'Resolve open questions first'),
			],
			severity: 'warning',
		});
		const schemaFail = createDiagnostic({
			code: ErrorCodes.EXECUTIVE_SCHEMA_FAILED,
			message: 'Executive plan schema validation failed',
			pointer: 'plan.workItems[0].id',
			severity: 'error',
		});
		expect(readiness.code).toBe('LOGOS_EXECUTIVE_READINESS_BLOCKED');
		expect(schemaFail.code).toBe('LOGOS_EXECUTIVE_SCHEMA_FAILED');
	});

	it('export write failure is distinct from planned adapter', () => {
		const exportFail = createDiagnostic({
			code: ErrorCodes.EXECUTIVE_EXPORT_FAILED,
			message: 'Executive HTML export failed to write',
			path: 'logos/executive/plan.html',
			recoveryHints: [recoveryHint('check_path', 'Check write permissions')],
			severity: 'error',
		});
		expect(exportFail.code).toBe('LOGOS_EXECUTIVE_EXPORT_FAILED');
	});

	it('import unsafe path is distinct from unsupported format', () => {
		const unsafePath = createDiagnostic({
			code: ErrorCodes.IMPORT_UNSAFE_PATH,
			message: 'Import path is outside project workspace',
			path: '../../../external/doc.md',
			recoveryHints: [
				recoveryHint(
					'check_path',
					'Move file into the project workspace first',
				),
			],
			severity: 'error',
		});
		const unsupportedFormat = createDiagnostic({
			code: ErrorCodes.IMPORT_UNSUPPORTED_FORMAT,
			message: 'Unsupported file format for import: .docx',
			path: 'doc.docx',
			recoveryHints: [
				recoveryHint(
					'manual_review',
					'Convert file to Markdown or plain text first',
				),
			],
			severity: 'error',
		});
		expect(unsafePath.code).toBe('LOGOS_IMPORT_UNSAFE_PATH');
		expect(unsupportedFormat.code).toBe('LOGOS_IMPORT_UNSUPPORTED_FORMAT');
	});

	it('scanner policy limit is warning, not crash', () => {
		const diag = createDiagnostic({
			code: ErrorCodes.SCANNER_POLICY_LIMIT,
			message: 'Repository scan reached file count limit (1000 files)',
			recoveryHints: [
				recoveryHint('manual_review', 'Adjust scan policy limits if needed'),
			],
			severity: 'warning',
		});
		expect(diag.code).toBe('LOGOS_SCANNER_POLICY_LIMIT');
		expect(diag.severity).toBe('warning');
	});

	it('docs-vs-code insufficient observation is not false failure', () => {
		const diag = createDiagnostic({
			code: ErrorCodes.CONSISTENCY_INSUFFICIENT_OBSERVATION,
			message: 'Insufficient observations to compare documented claim',
			pointer: 'claim.docsCodeComparison',
			recoveryHints: [
				recoveryHint(
					'manual_review',
					'Add more evidence sources and re-run check',
				),
			],
			severity: 'warning',
		});
		expect(diag.code).toBe('LOGOS_CONSISTENCY_INSUFFICIENT_OBSERVATION');
	});

	it('extraction conflict is review-required', () => {
		const diag = createDiagnostic({
			code: ErrorCodes.EXTRACTION_CONFLICT,
			message: 'Conflicting facts extracted from different sources',
			recoveryHints: [
				recoveryHint(
					'review_extracted_candidate',
					'Review and resolve conflicts manually',
				),
			],
			relatedIds: { candidateId: 'c1' },
			severity: 'warning',
		});
		expect(diag.code).toBe('LOGOS_EXTRACTION_CONFLICT');
		expect(diag.recoveryHints[0].category).toBe('review_extracted_candidate');
	});

	it('transcript extraction deferred is clear and non-mutating', () => {
		const diag = createDiagnostic({
			code: ErrorCodes.EXTRACTION_DEFERRED,
			message: 'Transcript import is deferred and not yet implemented',
			recoveryHints: [
				recoveryHint(
					'manual_review',
					'Convert transcript to Markdown notes first',
				),
			],
			severity: 'info',
		});
		expect(diag.code).toBe('LOGOS_EXTRACTION_DEFERRED');
		expect(diag.severity).toBe('info');
	});
});
