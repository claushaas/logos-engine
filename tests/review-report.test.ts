import { mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { initWorkspace } from '../src/init/init-execute.js';
import { runDiagnoseCommand } from '../src/validation/diagnose-command.js';
import {
	computeReportChecksum,
	renderValidationReportJson,
	renderValidationReportMarkdown,
} from '../src/validation/review-report.js';
import { runValidateCommand } from '../src/validation/validate-command.js';

const ID_FACTORY = () => 'rpt-0001';
const CLOCK = { now: () => '2025-01-01T00:00:00.000Z' };

const tempDirs: string[] = [];

async function createTempDir(): Promise<string> {
	const dir = join(
		tmpdir(),
		`logos-rpt-${Date.now()}-${Math.random().toString(36).slice(2)}`,
	);
	await mkdir(dir, { recursive: true });
	tempDirs.push(dir);
	return dir;
}

afterEach(async () => {
	for (const dir of tempDirs) {
		await rm(dir, { force: true, recursive: true });
	}
	tempDirs.length = 0;
});

async function initTempWorkspace(projectRoot: string): Promise<void> {
	const result = await initWorkspace({
		_testTimestamp: '2025-01-01T00:00:00.000Z',
		confirm: true,
		projectRoot,
	});
	if (!result.success) throw new Error('Failed to init workspace in test');
}

describe('review report generation', () => {
	it('validation Markdown report is generated with title, status, counts, findings', async () => {
		const projectRoot = await createTempDir();
		await initTempWorkspace(projectRoot);

		const result = await runValidateCommand({
			clock: CLOCK,
			idFactory: ID_FACTORY,
			projectRoot,
		});

		expect(result.data.reportPath).toBeDefined();

		const reportPath = result.data.reportPath as string;
		const fs = await import('node:fs/promises');
		const content = await fs.readFile(
			resolve(projectRoot, reportPath),
			'utf-8',
		);

		expect(content).toContain('Validation Report');
		expect(content).toContain('Gate Status');
		expect(content).toContain('Findings');
		expect(content).toContain('Recovery');
		expect(content).toContain('LOGOS Engine');
		expect(content).toContain('Summary');
	});

	it('diagnostic Markdown report is generated with deterministic explanation', async () => {
		const projectRoot = await createTempDir();
		await initTempWorkspace(projectRoot);

		const result = await runDiagnoseCommand({
			clock: CLOCK,
			idFactory: ID_FACTORY,
			projectRoot,
		});

		expect(result.data.reportPath).toBeDefined();

		const reportPath2 = result.data.reportPath as string;
		const fs2 = await import('node:fs/promises');
		const content2 = await fs2.readFile(
			resolve(projectRoot, reportPath2),
			'utf-8',
		);

		expect(content2).toContain('Diagnostic Report');
		expect(content2).toContain('Gate Status');
		expect(content2).toContain('Deterministic Diagnosis');
		expect(content2).toContain('Suggested Actions');
	});

	it('JSON report is valid JSON', async () => {
		const projectRoot = await createTempDir();
		await initTempWorkspace(projectRoot);

		const result = await runValidateCommand({
			clock: CLOCK,
			idFactory: ID_FACTORY,
			projectRoot,
			reportFormat: 'json',
		});

		expect(result.data.reportPath).toBeDefined();

		const reportPath3 = result.data.reportPath as string;
		const fs3 = await import('node:fs/promises');
		const content3 = await fs3.readFile(
			resolve(projectRoot, reportPath3),
			'utf-8',
		);
		const parsed = JSON.parse(content3);

		expect(parsed.reportKind).toBe('validation');
		expect(parsed.gateStatus).toBeDefined();
		expect(parsed.findings).toBeDefined();
		expect(Array.isArray(parsed.findings)).toBe(true);
	});

	it('report paths are under logos/reports/', async () => {
		const projectRoot = await createTempDir();
		await initTempWorkspace(projectRoot);

		const result = await runValidateCommand({
			clock: CLOCK,
			idFactory: ID_FACTORY,
			projectRoot,
		});

		expect(result.data.reportPath).toContain('logos/reports/');
	});

	it('report artifacts are non-canonical', async () => {
		const projectRoot = await createTempDir();
		await initTempWorkspace(projectRoot);

		await runValidateCommand({
			clock: CLOCK,
			idFactory: ID_FACTORY,
			projectRoot,
		});

		const { readWorkspaceState } = await import(
			'../src/state/workspace-state-repository.js'
		);
		const stateRead = await readWorkspaceState({ projectRoot });
		const reportArtifacts = (stateRead.state?.artifacts ?? []).filter(
			(a) => a.artifactType === 'report',
		);

		expect(reportArtifacts.length).toBeGreaterThan(0);
		for (const a of reportArtifacts) {
			expect(a.isCanonical).toBe(false);
		}
	});

	it('reports do not claim AI changed deterministic severity', async () => {
		const projectRoot = await createTempDir();
		await initTempWorkspace(projectRoot);

		const result = await runDiagnoseCommand({
			clock: CLOCK,
			idFactory: ID_FACTORY,
			projectRoot,
		});

		if (result.data.reportPath) {
			const fs = await import('node:fs/promises');
			const content = await fs.readFile(
				resolve(projectRoot, result.data.reportPath),
				'utf-8',
			);
			expect(content).not.toContain('AI has changed the severity');
			expect(content).not.toContain('AI modified');
			if (content.includes('AI Interpretation')) {
				expect(content).toContain('does not alter deterministic severity');
			}
		}
	});

	it('reports do not include fake secrets', async () => {
		const projectRoot = await createTempDir();
		await initTempWorkspace(projectRoot);

		const result = await runValidateCommand({
			clock: CLOCK,
			idFactory: ID_FACTORY,
			projectRoot,
		});

		if (result.data.reportPath) {
			const fs = await import('node:fs/promises');
			const content = await fs.readFile(
				resolve(projectRoot, result.data.reportPath),
				'utf-8',
			);
			expect(content).not.toMatch(/sk-[a-zA-Z0-9]{20,}/);
			expect(content).not.toMatch(/gsk_/);
			expect(content).not.toMatch(/hf_/);
			expect(content).not.toMatch(/Bearer\s+\S{10,}/i);
		}
	});

	it('report generation uses safe filesystem writes', async () => {
		const projectRoot = await createTempDir();
		await initTempWorkspace(projectRoot);

		const result = await runValidateCommand({
			clock: CLOCK,
			idFactory: ID_FACTORY,
			projectRoot,
		});

		expect(result.status).not.toBe('error');
		if (result.data.reportPath) {
			const fs = await import('node:fs/promises');
			const exists = await fs
				.stat(resolve(projectRoot, result.data.reportPath))
				.then(() => true)
				.catch(() => false);
			expect(exists).toBe(true);

			const { existsSync } = await import('node:fs');
			const tmpFileExists = existsSync(
				join(
					resolve(projectRoot, 'logos', 'reports'),
					'.validation-val-0001.md',
				),
			);
			expect(tmpFileExists).toBe(false);
		}
	});

	it('reports do not include raw prompts or model responses', async () => {
		const projectRoot = await createTempDir();
		await initTempWorkspace(projectRoot);

		const result = await runValidateCommand({
			clock: CLOCK,
			idFactory: ID_FACTORY,
			projectRoot,
		});

		if (result.data.reportPath) {
			const fs = await import('node:fs/promises');
			const content = await fs.readFile(
				resolve(projectRoot, result.data.reportPath),
				'utf-8',
			);
			expect(content).not.toContain('raw_prompt');
			expect(content).not.toContain('raw_model_response');
			expect(content).not.toContain('system_prompt');
		}
	});
});

describe('renderValidationReportMarkdown', () => {
	it('renders complete markdown report', () => {
		const content = renderValidationReportMarkdown({
			activeProfileId: 'standard',
			changedPaths: [],
			diagnostics: [],
			documentationRoot: 'logos/',
			dryRun: false,
			findings: [],
			gateStatus: 'pass',
			generatedAt: '2025-01-01T00:00:00.000Z',
			projectRoot: '/test/project',
			recoveryHints: [],
			reportId: 'rpt-test',
			reportKind: 'validation',
			runId: 'run-test',
			scopesChecked: ['contracts', 'state'],
			summary: {
				bySeverity: { error: 0, fatal: 0, info: 0, warning: 0 },
				bySource: {},
				totalFindings: 0,
			},
			title: 'Validation Report',
		});

		expect(content).toContain('Validation Report');
		expect(content).toContain('PASS');
		expect(content).toContain('standard');
		expect(content).toContain('run-test');
		expect(content).toContain('non-canonical');
	});

	it('includes findings table when findings exist', () => {
		const content = renderValidationReportMarkdown({
			activeProfileId: 'standard',
			changedPaths: [],
			diagnostics: [],
			documentationRoot: 'logos/',
			dryRun: false,
			findings: [
				{
					code: 'test_finding',
					id: 'f-001',
					location: { path: '/test/a.md', pointer: '/section' },
					message: 'Test finding message',
					order: 0,
					severity: 'error',
					source: { kind: 'validation_service', path: '/test' },
				},
			],
			gateStatus: 'fail',
			generatedAt: '2025-01-01T00:00:00.000Z',
			projectRoot: '/test/project',
			recoveryHints: ['Fix the issue'],
			reportId: 'rpt-test',
			reportKind: 'validation',
			runId: 'run-test',
			scopesChecked: ['contracts'],
			summary: {
				bySeverity: { error: 1, fatal: 0, info: 0, warning: 0 },
				bySource: { validation_service: 1 },
				totalFindings: 1,
			},
			title: 'Validation Report',
		});

		expect(content).toContain('FAIL');
		expect(content).toContain('test_finding');
		expect(content).toContain('Test finding message');
		expect(content).toContain('Fix the issue');
	});

	it('includes AI interpretation section when provided', () => {
		const content = renderValidationReportMarkdown({
			activeProfileId: 'standard',
			aiInterpretationSection: 'This is an AI-generated explanation.',
			aiInterpretationSource: 'fake_provider',
			changedPaths: [],
			diagnostics: [],
			documentationRoot: 'logos/',
			dryRun: false,
			findings: [],
			gateStatus: 'pass',
			generatedAt: '2025-01-01T00:00:00.000Z',
			projectRoot: '/test/project',
			recoveryHints: [],
			reportId: 'rpt-test',
			reportKind: 'diagnostic',
			runId: 'run-test',
			scopesChecked: [],
			summary: {
				bySeverity: { error: 0, fatal: 0, info: 0, warning: 0 },
				bySource: {},
				totalFindings: 0,
			},
			title: 'Diagnostic Report',
		});

		expect(content).toContain('AI Interpretation');
		expect(content).toContain('fake_provider');
		expect(content).toContain('does not alter deterministic severity');
	});
});

describe('renderValidationReportJson', () => {
	it('renders valid JSON report', () => {
		const content = renderValidationReportJson({
			activeProfileId: 'standard',
			changedPaths: [],
			diagnostics: [],
			documentationRoot: 'logos/',
			dryRun: false,
			findings: [],
			gateStatus: 'pass',
			generatedAt: '2025-01-01T00:00:00.000Z',
			projectRoot: '/test/project',
			recoveryHints: [],
			reportId: 'rpt-test',
			reportKind: 'validation',
			runId: 'run-test',
			scopesChecked: ['contracts'],
			summary: {
				bySeverity: { error: 0, fatal: 0, info: 0, warning: 0 },
				bySource: {},
				totalFindings: 0,
			},
			title: 'Validation Report',
		});

		const parsed = JSON.parse(content);
		expect(parsed.reportKind).toBe('validation');
		expect(parsed.gateStatus).toBe('pass');
		expect(parsed.reportId).toBe('rpt-test');
	});
});

describe('computeReportChecksum', () => {
	it('produces valid SHA-256 hex string', () => {
		const checksum = computeReportChecksum('test content');
		expect(checksum).toMatch(/^[a-f0-9]{64}$/);
	});

	it('is deterministic', () => {
		expect(computeReportChecksum('test')).toBe(computeReportChecksum('test'));
	});

	it('differs for different content', () => {
		expect(computeReportChecksum('a')).not.toBe(computeReportChecksum('b'));
	});
});
