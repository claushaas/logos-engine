import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const DIST_CLI = join(process.cwd(), 'dist', 'cli.js');

function makeTempDir(prefix: string): string {
	return mkdtempSync(join(tmpdir(), prefix));
}

describe('logos doctor --json integration', () => {
	it('exits 0 and emits valid JSON without initialized workspace', () => {
		const dir = makeTempDir('logos-doctor-json-');
		const output = execSync(`node "${DIST_CLI}" doctor --json`, {
			cwd: dir,
			encoding: 'utf-8',
		});
		const parsed = JSON.parse(output);
		expect(parsed.status).toBe('success');
		expect(parsed.command).toBe('doctor');
		expect(parsed.dryRun).toBe(false);
		expect(Array.isArray(parsed.messages)).toBe(true);
		expect(Array.isArray(parsed.warnings)).toBe(true);
		expect(Array.isArray(parsed.errors)).toBe(true);
		expect(Array.isArray(parsed.changedPaths)).toBe(true);
		expect(parsed.data).toBeDefined();
	});

	it('JSON includes project context data', () => {
		const dir = makeTempDir('logos-doctor-json-ctx-');
		mkdirSync(join(dir, '.git'));
		const output = execSync(`node "${DIST_CLI}" doctor --json`, {
			cwd: dir,
			encoding: 'utf-8',
		});
		const parsed = JSON.parse(output);
		expect(parsed.data.cwd === dir || parsed.data.cwd === '.').toBe(true);
		expect(
			parsed.data.projectRoot === dir || parsed.data.projectRoot === '.',
		).toBe(true);
		expect(parsed.data.rootKind).toBe('git');
		expect(
			parsed.data.logosPath === join(dir, '.logos') ||
				parsed.data.logosPath === '.logos',
		).toBe(true);
		expect(parsed.data.initializationState).toBe('missing');
		expect(parsed.data.documentationRoot).toBe('logos/');
		expect(parsed.data.activeProfile).toBe('standard');
	});

	it('JSON reports missing initialization as recoverable', () => {
		const dir = makeTempDir('logos-doctor-json-rec-');
		const output = execSync(`node "${DIST_CLI}" doctor --json`, {
			cwd: dir,
			encoding: 'utf-8',
		});
		const parsed = JSON.parse(output);
		expect(parsed.status).toBe('success');
		expect(parsed.errors).toEqual([]);
		expect(parsed.data.initializationState).toBe('missing');
	});

	it('JSON does not include human prose outside JSON', () => {
		const dir = makeTempDir('logos-doctor-json-clean-');
		const output = execSync(`node "${DIST_CLI}" doctor --json`, {
			cwd: dir,
			encoding: 'utf-8',
		});
		// Should be parseable as single JSON value
		const parsed = JSON.parse(output);
		expect(typeof parsed).toBe('object');
	});

	it('JSON does not expose secret-like fixture values', () => {
		const dir = makeTempDir('logos-doctor-json-redact-');
		mkdirSync(join(dir, '.logos'));
		writeFileSync(
			join(dir, '.logos', 'workspace.json'),
			JSON.stringify({
				provider: { providerId: 'openai', token: 'sk-abc123secret456' },
			}),
		);
		const output = execSync(`node "${DIST_CLI}" doctor --json`, {
			cwd: dir,
			encoding: 'utf-8',
		});
		expect(output).not.toContain('sk-abc123');
		expect(output).not.toContain('secret456');
	});

	it('JSON has changedPaths: []', () => {
		const dir = makeTempDir('logos-doctor-json-cp-');
		const output = execSync(`node "${DIST_CLI}" doctor --json`, {
			cwd: dir,
			encoding: 'utf-8',
		});
		const parsed = JSON.parse(output);
		expect(parsed.changedPaths).toEqual([]);
	});
});

describe('logos doctor --dry-run integration', () => {
	it('exits 0 with --dry-run', () => {
		const dir = makeTempDir('logos-doctor-dry-');
		const output = execSync(`node "${DIST_CLI}" doctor --dry-run`, {
			cwd: dir,
			encoding: 'utf-8',
		});
		expect(output).toContain('Node.js:');
		expect(output).toContain('dry-run');
	});

	it('exits 0 with --json --dry-run', () => {
		const dir = makeTempDir('logos-doctor-json-dry-');
		const output = execSync(`node "${DIST_CLI}" doctor --json --dry-run`, {
			cwd: dir,
			encoding: 'utf-8',
		});
		const parsed = JSON.parse(output);
		expect(parsed.status).toBe('dry_run');
		expect(parsed.dryRun).toBe(true);
		expect(parsed.changedPaths).toEqual([]);
	});

	it('dry-run does not create .logos/', () => {
		const dir = makeTempDir('logos-doctor-dry-no-create-');
		execSync(`node "${DIST_CLI}" doctor --dry-run`, {
			cwd: dir,
			encoding: 'utf-8',
		});
		expect(existsSync(join(dir, '.logos'))).toBe(false);
	});

	it('dry-run result indicates no writes and no changed paths', () => {
		const dir = makeTempDir('logos-doctor-dry-check-');
		const output = execSync(`node "${DIST_CLI}" doctor --json --dry-run`, {
			cwd: dir,
			encoding: 'utf-8',
		});
		const parsed = JSON.parse(output);
		expect(parsed.dryRun).toBe(true);
		expect(parsed.changedPaths).toEqual([]);
		expect(parsed.data.initializationState).toBe('missing');
	});
});

describe('logos doctor human output', () => {
	it('remains human-readable without --json', () => {
		const dir = makeTempDir('logos-doctor-human-');
		const output = execSync(`node "${DIST_CLI}" doctor`, {
			cwd: dir,
			encoding: 'utf-8',
		});
		expect(output).toContain('Node.js:');
		expect(output).toContain('Package:');
		expect(output).toContain('Current working directory');
	});

	it('is not JSON unless --json is passed', () => {
		const dir = makeTempDir('logos-doctor-not-json-');
		const output = execSync(`node "${DIST_CLI}" doctor`, {
			cwd: dir,
			encoding: 'utf-8',
		});
		// Should not parse as JSON
		expect(() => JSON.parse(output)).toThrow();
	});

	it('includes recovery hint for missing initialization', () => {
		const dir = makeTempDir('logos-doctor-recovery-');
		const output = execSync(`node "${DIST_CLI}" doctor`, {
			cwd: dir,
			encoding: 'utf-8',
		});
		expect(output).toContain('Recovery');
		expect(output).toContain('/init');
	});

	it('does not expose secrets in human output', () => {
		const dir = makeTempDir('logos-doctor-human-secret-');
		mkdirSync(join(dir, '.logos'));
		writeFileSync(
			join(dir, '.logos', 'workspace.json'),
			JSON.stringify({
				provider: { providerId: 'openai', token: 'sk-abc123' },
			}),
		);
		const output = execSync(`node "${DIST_CLI}" doctor`, {
			cwd: dir,
			encoding: 'utf-8',
		});
		expect(output).not.toContain('sk-abc123');
	});
});
