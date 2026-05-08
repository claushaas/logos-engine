import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
	createLogosApplicationServices,
	detectProjectRoot,
	handleSlashCommand,
	initializeWorkspace,
	loadCommandContext,
	parseSlashCommand,
	readWorkspaceState,
	SafeWriteError,
	safeWriteTextFile,
	WorkspaceStateReadError,
} from '../../src/index.js';

describe('workspace initialization', () => {
	it('detects the nearest project root from a nested directory', () => {
		const projectRoot = createProjectRoot();
		const nestedDirectory = join(projectRoot, 'packages', 'app');
		mkdirSync(nestedDirectory, { recursive: true });

		expect(detectProjectRoot(nestedDirectory)).toBe(projectRoot);
	});

	it('creates a valid LOGOS workspace from /init', async () => {
		const projectRoot = createProjectRoot();
		const nestedDirectory = join(projectRoot, 'src');
		mkdirSync(nestedDirectory, { recursive: true });

		const parsed = parseSlashCommand('/init');
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) {
			throw new Error(parsed.error.message);
		}

		const result = await handleSlashCommand(
			parsed.command,
			loadCommandContext(nestedDirectory),
			createLogosApplicationServices(),
		);

		expect(result).toMatchObject({
			exitRequested: false,
			status: 'ok',
			title: 'Workspace initialized',
		});
		expect(result.body.join('\n')).toContain('.logos/project.json');

		for (const path of [
			'.logos',
			'.logos/sessions',
			'.logos/proposals',
			'.logos/project.json',
			'.logos/profile.lock.json',
			'.logos/answers.json',
			'.logos/decisions.json',
			'.logos/diagnostics.json',
			'.logos/config.json',
			'docs/00-intake',
			'docs/01-market',
			'docs/02-business',
			'docs/03-economics',
			'docs/04-product',
			'docs/05-design',
			'docs/06-architecture',
			'docs/07-implementation',
			'docs/08-testing',
			'docs/09-go-to-market',
			'docs/10-operations',
			'docs/11-governance',
		]) {
			expect(existsSync(join(projectRoot, path)), path).toBe(true);
		}

		const workspaceState = readWorkspaceState(projectRoot);

		expect(workspaceState.project).toMatchObject({
			profileId: 'app-business',
			projectName: basename(projectRoot),
			projectRoot: '.',
		});
		expect(workspaceState.profileLock).toMatchObject({
			documentCount: 32,
			profileId: 'app-business',
			profileName: 'App Business',
			profileVersion: '0.1.0',
		});
		expect(workspaceState.answers.answers).toEqual([]);
		expect(workspaceState.decisions.decisions).toEqual([]);
		expect(workspaceState.diagnostics.diagnostics).toEqual([]);
		expect(workspaceState.config.ai).toMatchObject({
			enabled: false,
			tokenSource: null,
		});
	});

	it('detects a repeated init without rewriting existing state', () => {
		const projectRoot = createProjectRoot();
		const firstResult = initializeWorkspace(projectRoot);
		const originalProjectJson = readFileSync(
			join(projectRoot, '.logos', 'project.json'),
			'utf8',
		);
		const secondResult = initializeWorkspace(projectRoot);
		const repeatedProjectJson = readFileSync(
			join(projectRoot, '.logos', 'project.json'),
			'utf8',
		);

		expect(firstResult.status).toBe('created');
		expect(secondResult.status).toBe('exists');
		expect(repeatedProjectJson).toBe(originalProjectJson);
	});

	it('rejects corrupted workspace state during read and repeated init', () => {
		const projectRoot = createProjectRoot();
		initializeWorkspace(projectRoot);
		writeFileSync(
			join(projectRoot, '.logos', 'decisions.json'),
			'{"decisions":[]}\n',
			'utf8',
		);

		expect(() => readWorkspaceState(projectRoot)).toThrow(
			WorkspaceStateReadError,
		);
		expect(() => initializeWorkspace(projectRoot)).toThrow(
			WorkspaceStateReadError,
		);
	});

	it('refuses to overwrite existing files with safe writes', () => {
		const projectRoot = createProjectRoot();
		const path = join(projectRoot, 'notes.txt');

		safeWriteTextFile(path, 'first\n');

		expect(() => safeWriteTextFile(path, 'second\n')).toThrow(SafeWriteError);
		expect(readFileSync(path, 'utf8')).toBe('first\n');
	});
});

function createProjectRoot(): string {
	const projectRoot = mkdtempSync(join(tmpdir(), 'logos-workspace-'));
	mkdirSync(join(projectRoot, '.git'));

	return projectRoot;
}
