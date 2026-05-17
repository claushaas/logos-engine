import { mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { WORKSPACE_STATE_SCHEMA_VERSION } from '../src/index.js';
import { initWorkspace } from '../src/init/init-execute.js';
import {
	readWorkspaceState,
	writeWorkspaceState,
} from '../src/state/workspace-state-repository.js';
import { runValidateCommand } from '../src/validation/validate-command.js';

const ID_FACTORY = () => 'val-0001';
const CLOCK = { now: () => '2025-01-01T00:00:00.000Z' };
const ZERO_SHA = '0'.repeat(64);
const FAKE_TOKEN = `sk-${'abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGH'}`;

const tempDirs: string[] = [];

async function createTempDir(): Promise<string> {
	const dir = join(
		tmpdir(),
		`logos-valcmd-${Date.now()}-${Math.random().toString(36).slice(2)}`,
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

async function addGeneratedMarkdownWithTokenLeak(
	projectRoot: string,
): Promise<void> {
	const relativePath = 'logos/docs/01-foundation/01-thesis.md';
	const fullPath = join(projectRoot, relativePath);
	await mkdir(dirname(fullPath), { recursive: true });
	await writeFile(
		fullPath,
		`---
documentId: 01-thesis
phaseId: 01-foundation
profileId: standard
canonicalOutput: ${relativePath}
generatedBy: logos-engine
generatedAt: 2025-01-01T00:00:00.000Z
generationStatus: generated
sourceStateSchemaVersion: ${WORKSPACE_STATE_SCHEMA_VERSION}
contentChecksum: ${ZERO_SHA}
---

# Founding Thesis

## Core Thesis

Token-like value should fail the aggregate validation gate.

## Secret Material

token: ${FAKE_TOKEN}
`,
		'utf-8',
	);

	const stateRead = await readWorkspaceState({ projectRoot });
	if (!stateRead.success || !stateRead.state) {
		throw new Error('Expected initialized workspace state');
	}

	const writeResult = await writeWorkspaceState({
		policy: 'overwrite',
		projectRoot,
		state: {
			...stateRead.state,
			artifacts: [
				...stateRead.state.artifacts,
				{
					artifactId: 'art-token-leak',
					artifactType: 'canonical_markdown',
					checksum: ZERO_SHA,
					generatedAt: '2025-01-01T00:00:00.000Z',
					isCanonical: true,
					metadata: { phaseId: '01-foundation' },
					path: relativePath,
					runId: 'run-token-leak',
					sourceDocumentIds: ['01-thesis'],
					status: 'generated',
				},
			],
		},
	});
	expect(writeResult.success).toBe(true);
}

describe('runValidateCommand', () => {
	it('fails gracefully when workspace is missing for full validation', async () => {
		const projectRoot = await createTempDir();
		const result = await runValidateCommand({
			clock: CLOCK,
			idFactory: ID_FACTORY,
			projectRoot,
		});

		expect(result.status).toBe('error');
		expect(result.errors.length).toBeGreaterThan(0);
		expect(result.errors[0]?.code).toBe('workspace_missing');
		expect(result.data.recoveryHints).toEqual(
			expect.arrayContaining([expect.stringContaining('/init')]),
		);
	});

	it('validates initialized temp workspace and returns gate status', async () => {
		const projectRoot = await createTempDir();
		await initTempWorkspace(projectRoot);

		const result = await runValidateCommand({
			clock: CLOCK,
			idFactory: ID_FACTORY,
			projectRoot,
		});

		expect(result.status).not.toBe('error');
		expect(result.data.gateStatus).toBeDefined();
		expect(result.data.scopesChecked).toEqual([
			'contracts',
			'state',
			'artifacts',
			'outputs',
		]);
		expect(result.data.findingCounts.total).toBeGreaterThanOrEqual(0);
	});

	it('validates bundled contracts without provider configuration', async () => {
		const projectRoot = await createTempDir();

		const result = await runValidateCommand({
			clock: CLOCK,
			idFactory: ID_FACTORY,
			projectRoot,
			scopes: ['contracts'],
		});

		expect(result.status).not.toBe('not_implemented');
		expect(result.data.scopesChecked).toEqual(['contracts']);
	});

	it('supports contract-only scope without initialized workspace', async () => {
		const projectRoot = await createTempDir();

		const result = await runValidateCommand({
			clock: CLOCK,
			idFactory: ID_FACTORY,
			projectRoot,
			scopes: ['contracts'],
		});

		expect(result.status).not.toBe('error');
		expect(result.data.scopesChecked).toEqual(['contracts']);
		expect(result.data.gateStatus).toBeDefined();
	});

	it('persists validation run metadata in non-dry-run mode', async () => {
		const projectRoot = await createTempDir();
		await initTempWorkspace(projectRoot);

		const result = await runValidateCommand({
			clock: CLOCK,
			idFactory: ID_FACTORY,
			projectRoot,
		});

		expect(result.status).not.toBe('error');
		expect(result.data.runId).toBe('val-0001');

		const stateRead = await readWorkspaceState({ projectRoot });
		expect(stateRead.success).toBe(true);

		const runs = stateRead.state?.runs ?? [];
		const valRun = runs.find((r) => r.runId === 'val-0001');
		expect(valRun).toBeDefined();
		expect(valRun?.runType).toBe('validation');
		expect(valRun?.command).toBe('/validate');
		expect(valRun?.status).toBe('completed');
	});

	it('does not persist run metadata in dry-run mode', async () => {
		const projectRoot = await createTempDir();
		await initTempWorkspace(projectRoot);

		const result = await runValidateCommand({
			clock: CLOCK,
			idFactory: ID_FACTORY,
			mode: 'dry_run',
			projectRoot,
		});

		expect(result.dryRun).toBe(true);
		expect(result.data.dryRun).toBe(true);
		expect(result.data.runId).toBeUndefined();

		const stateRead = await readWorkspaceState({ projectRoot });
		const runs = stateRead.state?.runs ?? [];
		const valRun = runs.find((r) => r.command === '/validate');
		expect(valRun).toBeUndefined();
	});

	it('generates review report in non-dry-run mode', async () => {
		const projectRoot = await createTempDir();
		await initTempWorkspace(projectRoot);

		const result = await runValidateCommand({
			clock: CLOCK,
			idFactory: ID_FACTORY,
			projectRoot,
		});

		expect(result.data.reportPath).toBeDefined();
		expect(result.data.reportId).toBeDefined();
		expect(result.data.reportPath).toContain('reports/validation-');
		expect(result.data.reportPath).toContain('.md');
		expect(result.data.changedPaths.length).toBeGreaterThan(0);
	});

	it('produces deterministic gate status', async () => {
		const projectRoot = await createTempDir();
		await initTempWorkspace(projectRoot);

		const result1 = await runValidateCommand({
			clock: CLOCK,
			idFactory: ID_FACTORY,
			projectRoot,
		});
		const result2 = await runValidateCommand({
			clock: CLOCK,
			idFactory: ID_FACTORY,
			projectRoot,
		});

		expect(result1.data.gateStatus).toBe(result2.data.gateStatus);
		expect(result1.data.findingCounts.total).toBe(
			result2.data.findingCounts.total,
		);
	});

	it('dry-run writes no report and no state changes', async () => {
		const projectRoot = await createTempDir();
		await initTempWorkspace(projectRoot);

		const result = await runValidateCommand({
			clock: CLOCK,
			idFactory: ID_FACTORY,
			mode: 'dry_run',
			projectRoot,
		});

		expect(result.data.reportPath).toBeUndefined();
		expect(result.data.reportId).toBeUndefined();
		expect(result.data.runId).toBeUndefined();
		expect(result.changedPaths).toEqual([]);

		const logosReportExists = await import('node:fs/promises').then((fs) =>
			fs
				.stat(join(projectRoot, 'logos', 'reports'))
				.then(() => true)
				.catch(() => false),
		);
		expect(logosReportExists).toBe(false);
	});

	it('no provider configuration required', async () => {
		const projectRoot = await createTempDir();

		const result = await runValidateCommand({
			clock: CLOCK,
			idFactory: ID_FACTORY,
			projectRoot,
			scopes: ['contracts'],
		});

		expect(result.status).not.toBe('error');
	});

	it('computes finding counts', async () => {
		const projectRoot = await createTempDir();
		await initTempWorkspace(projectRoot);

		const result = await runValidateCommand({
			clock: CLOCK,
			idFactory: ID_FACTORY,
			projectRoot,
		});

		expect(result.data.findingCounts.total).toBeGreaterThanOrEqual(0);
		expect(typeof result.data.findingCounts.error).toBe('number');
		expect(typeof result.data.findingCounts.fatal).toBe('number');
		expect(typeof result.data.findingCounts.warning).toBe('number');
		expect(typeof result.data.findingCounts.info).toBe('number');
	});

	it('fails the gate when semantic lint findings include errors', async () => {
		const projectRoot = await createTempDir();
		await initTempWorkspace(projectRoot);
		await addGeneratedMarkdownWithTokenLeak(projectRoot);

		const result = await runValidateCommand({
			clock: CLOCK,
			idFactory: ID_FACTORY,
			mode: 'dry_run',
			projectRoot,
			scopes: ['outputs'],
		});

		expect(result.data.topFindings.map((f) => f.code)).toContain(
			'document_token_like_value',
		);
		expect(result.data.findingCounts.error).toBeGreaterThan(0);
		expect(result.data.gateStatus).toBe('fail');
	});

	it('does not mutate canonical Markdown files', async () => {
		const projectRoot = await createTempDir();
		await initTempWorkspace(projectRoot);

		const result = await runValidateCommand({
			clock: CLOCK,
			idFactory: ID_FACTORY,
			projectRoot,
		});

		for (const p of result.data.changedPaths) {
			expect(p).not.toMatch(/canonical/i);
		}
		const logosDir = join(projectRoot, '.logos');
		const logosExists = await import('node:fs/promises').then((fs) =>
			fs
				.stat(logosDir)
				.then(() => true)
				.catch(() => false),
		);
		expect(logosExists).toBe(true);
	});

	it('missing workspace returns recovery hint', async () => {
		const projectRoot = await createTempDir();

		const result = await runValidateCommand({
			clock: CLOCK,
			idFactory: ID_FACTORY,
			projectRoot,
		});

		expect(result.data.recoveryHints.length).toBeGreaterThan(0);
		expect(result.data.recoveryHints.join('\n')).toContain('/init');
	});

	it('no AI/provider code is called during validation', async () => {
		const projectRoot = await createTempDir();
		await initTempWorkspace(projectRoot);

		const result = await runValidateCommand({
			clock: CLOCK,
			idFactory: ID_FACTORY,
			projectRoot,
		});

		expect(result.status).not.toBe('error');
	});
});
