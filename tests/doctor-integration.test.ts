import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const DIST_CLI = join(process.cwd(), 'dist', 'cli.js');

function makeTempDir(prefix: string): string {
	return mkdtempSync(join(tmpdir(), prefix));
}

describe('logos doctor integration', () => {
	it('exits 0 in an uninitialized temp project', () => {
		const dir = makeTempDir('logos-doctor-uninit-');
		const output = execSync(`node "${DIST_CLI}" doctor`, {
			cwd: dir,
			encoding: 'utf-8',
		});
		expect(output).toContain('Current working directory');
		expect(output).toContain('not initialized');
	});

	it('output includes root path or not-detected status', () => {
		const dir = makeTempDir('logos-doctor-root-');
		mkdirSync(join(dir, '.git'));
		const output = execSync(`node "${DIST_CLI}" doctor`, {
			cwd: dir,
			encoding: 'utf-8',
		});
		expect(output).toContain('Project root:');
		expect(output).toContain(dir);
	});

	it('output includes initialization state', () => {
		const dir = makeTempDir('logos-doctor-state-');
		const output = execSync(`node "${DIST_CLI}" doctor`, {
			cwd: dir,
			encoding: 'utf-8',
		});
		expect(output).toContain('Initialization state:');
		expect(output).toContain('not initialized');
	});

	it('output includes documentation root', () => {
		const dir = makeTempDir('logos-doctor-docroot-');
		const output = execSync(`node "${DIST_CLI}" doctor`, {
			cwd: dir,
			encoding: 'utf-8',
		});
		expect(output).toContain('Documentation root:');
		expect(output).toContain('logos/');
	});

	it('output includes active profile', () => {
		const dir = makeTempDir('logos-doctor-profile-');
		const output = execSync(`node "${DIST_CLI}" doctor`, {
			cwd: dir,
			encoding: 'utf-8',
		});
		expect(output).toContain('Active profile:');
		expect(output).toContain('standard');
	});

	it('output includes provider status', () => {
		const dir = makeTempDir('logos-doctor-provider-');
		const output = execSync(`node "${DIST_CLI}" doctor`, {
			cwd: dir,
			encoding: 'utf-8',
		});
		expect(output).toContain('Provider status:');
		expect(output).toContain('not configured');
	});

	it('does not create .logos/ in temp project', () => {
		const dir = makeTempDir('logos-doctor-no-create-');
		execSync(`node "${DIST_CLI}" doctor`, {
			cwd: dir,
			encoding: 'utf-8',
		});
		expect(existsSync(join(dir, '.logos'))).toBe(false);
	});

	it('reports initialized state when workspace config exists', () => {
		const dir = makeTempDir('logos-doctor-init-');
		mkdirSync(join(dir, '.logos'));
		writeFileSync(join(dir, '.logos', 'workspace.json'), JSON.stringify({}));
		const output = execSync(`node "${DIST_CLI}" doctor`, {
			cwd: dir,
			encoding: 'utf-8',
		});
		expect(output).toContain('initialized');
	});

	it('reads custom documentation root from workspace config', () => {
		const dir = makeTempDir('logos-doctor-custom-root-');
		mkdirSync(join(dir, '.logos'));
		writeFileSync(
			join(dir, '.logos', 'workspace.json'),
			JSON.stringify({ documentationRoot: 'custom-docs/' }),
		);
		const output = execSync(`node "${DIST_CLI}" doctor`, {
			cwd: dir,
			encoding: 'utf-8',
		});
		expect(output).toContain('custom-docs/');
	});

	it('never exposes provider token in output', () => {
		const dir = makeTempDir('logos-doctor-secret-');
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
		expect(output).not.toContain('token');
	});
});
