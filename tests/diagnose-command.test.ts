import { mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { FakeProvider } from '../src/ai/fake-provider.js';
import { initWorkspace } from '../src/init/init-execute.js';
import { readWorkspaceState } from '../src/state/workspace-state-repository.js';
import { runDiagnoseCommand } from '../src/validation/diagnose-command.js';

const ID_FACTORY = () => 'diag-0001';
const CLOCK = { now: () => '2025-01-01T00:00:00.000Z' };

const tempDirs: string[] = [];

async function createTempDir(): Promise<string> {
	const dir = join(
		tmpdir(),
		`logos-diag-${Date.now()}-${Math.random().toString(36).slice(2)}`,
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

describe('runDiagnoseCommand', () => {
	it('runs deterministic diagnosis without provider configuration', async () => {
		const projectRoot = await createTempDir();
		await initTempWorkspace(projectRoot);

		const result = await runDiagnoseCommand({
			clock: CLOCK,
			idFactory: ID_FACTORY,
			projectRoot,
		});

		expect(result.status).not.toBe('error');
		expect(result.data.gateStatus).toBeDefined();
		expect(result.data.interpretationSource).toBe('deterministic');
	});

	it('deterministic diagnosis groups findings', async () => {
		const projectRoot = await createTempDir();
		await initTempWorkspace(projectRoot);

		const result = await runDiagnoseCommand({
			clock: CLOCK,
			idFactory: ID_FACTORY,
			projectRoot,
		});

		expect(result.data.groupedFindings).toBeDefined();
		expect(Array.isArray(result.data.groupedFindings)).toBe(true);
	});

	it('deterministic diagnosis suggests next actions', async () => {
		const projectRoot = await createTempDir();
		await initTempWorkspace(projectRoot);

		const result = await runDiagnoseCommand({
			clock: CLOCK,
			idFactory: ID_FACTORY,
			projectRoot,
		});

		expect(Array.isArray(result.data.suggestedActions)).toBe(true);
		expect(result.data.suggestedActions.length).toBeGreaterThan(0);
	});

	it('persists diagnostic run metadata in non-dry-run mode', async () => {
		const projectRoot = await createTempDir();
		await initTempWorkspace(projectRoot);

		const result = await runDiagnoseCommand({
			clock: CLOCK,
			idFactory: ID_FACTORY,
			projectRoot,
		});

		expect(result.status).not.toBe('error');
		expect(result.data.runId).toBe('diag-0001');

		const stateRead = await readWorkspaceState({ projectRoot });
		const runs = stateRead.state?.runs ?? [];
		const diagRun = runs.find((r) => r.runId === 'diag-0001');
		expect(diagRun).toBeDefined();
		expect(diagRun?.runType).toBe('diagnostic');
		expect(diagRun?.command).toBe('/diagnose');
	});

	it('generates diagnostic report artifact in non-dry-run mode', async () => {
		const projectRoot = await createTempDir();
		await initTempWorkspace(projectRoot);

		const result = await runDiagnoseCommand({
			clock: CLOCK,
			idFactory: ID_FACTORY,
			projectRoot,
		});

		expect(result.data.reportPath).toBeDefined();
		expect(result.data.reportPath).toContain('reports/diagnostic-');
	});

	it('dry-run writes nothing', async () => {
		const projectRoot = await createTempDir();
		await initTempWorkspace(projectRoot);

		const result = await runDiagnoseCommand({
			clock: CLOCK,
			idFactory: ID_FACTORY,
			mode: 'dry_run',
			projectRoot,
		});

		expect(result.data.dryRun).toBe(true);
		expect(result.data.reportPath).toBeUndefined();
		expect(result.data.runId).toBeUndefined();
		expect(result.changedPaths).toEqual([]);
	});

	it('missing workspace returns recovery hint', async () => {
		const projectRoot = await createTempDir();

		const result = await runDiagnoseCommand({
			clock: CLOCK,
			idFactory: ID_FACTORY,
			projectRoot,
		});

		expect(result.status).toBe('error');
		expect(result.data.recoveryHints).toEqual(
			expect.arrayContaining([expect.stringContaining('/init')]),
		);
	});

	it('AI interpretation with fake provider does not alter severity/gate/findings', async () => {
		const projectRoot = await createTempDir();
		await initTempWorkspace(projectRoot);

		const deterministicResult = await runDiagnoseCommand({
			clock: CLOCK,
			idFactory: ID_FACTORY,
			projectRoot,
		});

		const fakeProvider = new FakeProvider({ providerId: 'test-fake' });
		const aiResult = await runDiagnoseCommand({
			clock: CLOCK,
			idFactory: ID_FACTORY,
			projectRoot,
			provider: fakeProvider,
		});

		expect(aiResult.data.gateStatus).toBe(deterministicResult.data.gateStatus);
		expect(aiResult.data.findingCounts.total).toBe(
			deterministicResult.data.findingCounts.total,
		);
		expect(aiResult.data.findingCounts.error).toBe(
			deterministicResult.data.findingCounts.error,
		);
		expect(aiResult.data.findingCounts.fatal).toBe(
			deterministicResult.data.findingCounts.fatal,
		);
	});

	it('AI interpretation source is labeled correctly', async () => {
		const projectRoot = await createTempDir();
		await initTempWorkspace(projectRoot);

		const fakeProvider = new FakeProvider({ providerId: 'test-fake' });
		const result = await runDiagnoseCommand({
			clock: CLOCK,
			idFactory: ID_FACTORY,
			projectRoot,
			provider: fakeProvider,
		});

		expect(result.data.interpretationSource).toBe('fake_provider');
		expect(result.data.explanations.length).toBeGreaterThan(0);
	});

	it('invalid AI response falls back to deterministic', async () => {
		const projectRoot = await createTempDir();
		await initTempWorkspace(projectRoot);

		const failingProvider = new FakeProvider({
			providerId: 'test-fail',
			simulateFailure: true,
		});
		const result = await runDiagnoseCommand({
			clock: CLOCK,
			idFactory: ID_FACTORY,
			projectRoot,
			provider: failingProvider,
		});

		expect(result.data.interpretationSource).toBe('deterministic');
		expect(result.data.fallbackReason).toBeDefined();
	});

	it('remote provider without disclosure is blocked', async () => {
		const projectRoot = await createTempDir();
		await initTempWorkspace(projectRoot);

		const remoteProvider = new FakeProvider({
			providerId: 'test-remote',
		});
		(remoteProvider as Record<string, unknown>).providerKind = 'remote';

		const result = await runDiagnoseCommand({
			clock: CLOCK,
			idFactory: ID_FACTORY,
			projectRoot,
			provider: remoteProvider,
		});

		expect(result.data.interpretationSource).toBe('deterministic');
	});

	it('no raw prompts/model responses persisted', async () => {
		const projectRoot = await createTempDir();
		await initTempWorkspace(projectRoot);

		const fakeProvider = new FakeProvider({ providerId: 'test-fake' });
		await runDiagnoseCommand({
			clock: CLOCK,
			idFactory: ID_FACTORY,
			projectRoot,
			provider: fakeProvider,
		});

		const stateRead = await readWorkspaceState({ projectRoot });
		const stateJson = JSON.stringify(stateRead.state);

		expect(stateJson).not.toContain('sk-test');
		expect(stateJson).not.toContain('fake response');
	});
});
