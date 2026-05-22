import { describe, expect, it } from 'vitest';
import {
	getLogosConfigPath,
	getLogosRuntimeDir,
	LOGOS_CONFIG_FILE_NAME,
	LOGOS_RUNTIME_DIR,
} from '../../src/core/config/config-paths.js';
import {
	DEFAULT_PROFILE_ID,
	type LogosConfig,
} from '../../src/core/config/config-schema.js';
import { loadLogosConfig } from '../../src/core/config/load-config.js';
import { saveLogosConfig } from '../../src/core/config/save-config.js';
import type {
	DirectoryEntry,
	DirectoryListInput,
	FileExistsInput,
	FileReadResult,
	FileWriteInput,
	LogosFilesystem,
} from '../../src/core/ports/filesystem.js';

// ---------------------------------------------------------------------------
// In-memory fake filesystem
// ---------------------------------------------------------------------------

function createFakeFilesystem(): LogosFilesystem {
	const files = new Map<string, string>();
	const dirs = new Set<string>();

	return {
		async ensureDirectory(p: string): Promise<void> {
			dirs.add(p);
		},

		async fileExists(input: FileExistsInput): Promise<boolean> {
			return files.has(input.path);
		},

		async listDirectory(_input: DirectoryListInput): Promise<DirectoryEntry[]> {
			const prefix = _input.path;
			const entries: DirectoryEntry[] = [];
			for (const filePath of files.keys()) {
				if (filePath.startsWith(prefix)) {
					entries.push({ kind: 'file', path: filePath });
				}
			}
			for (const dirPath of dirs) {
				if (dirPath.startsWith(prefix) && dirPath !== prefix) {
					entries.push({ kind: 'directory', path: dirPath });
				}
			}
			return entries;
		},
		async readTextFile(p: string): Promise<FileReadResult> {
			const content = files.get(p);
			if (content === undefined) {
				throw new Error(`ENOENT: ${p}`);
			}
			return { content, path: p };
		},

		async writeTextFile(input: FileWriteInput): Promise<void> {
			if (!input.overwrite && files.has(input.path)) {
				throw new Error(`EEXIST: ${input.path}`);
			}
			files.set(input.path, input.content);
		},
	};
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('config paths', () => {
	it('LOGOS_RUNTIME_DIR is ".logos"', () => {
		expect(LOGOS_RUNTIME_DIR).toBe('.logos');
	});

	it('LOGOS_CONFIG_FILE_NAME is "config.yml"', () => {
		expect(LOGOS_CONFIG_FILE_NAME).toBe('config.yml');
	});

	it('getLogosRuntimeDir joins project root with .logos', () => {
		expect(getLogosRuntimeDir('/my/project')).toBe('/my/project/.logos');
	});

	it('getLogosConfigPath points to .logos/config.yml', () => {
		expect(getLogosConfigPath('/my/project')).toBe(
			'/my/project/.logos/config.yml',
		);
	});
});

describe('loadLogosConfig', () => {
	const now = '2026-05-22T00:00:00Z';

	it('returns default config when file does not exist (createdDefault: true)', async () => {
		const fs = createFakeFilesystem();
		const result = await loadLogosConfig({
			filesystem: fs,
			now,
			projectRoot: '/project',
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.createdDefault).toBe(true);
			expect(result.config.activeProfileId).toBe(DEFAULT_PROFILE_ID);
			expect(result.config.version).toBe(1);
			expect(result.warnings.length).toBeGreaterThan(0);
		}
	});

	it('returns existing config after saving', async () => {
		const fs = createFakeFilesystem();

		const config: LogosConfig = {
			activeProfileId: 'my-profile',
			createdAt: '2025-01-01T00:00:00Z',
			updatedAt: '2025-06-01T00:00:00Z',
			version: 1,
		};

		await saveLogosConfig({
			config,
			filesystem: fs,
			projectRoot: '/project',
		});

		const result = await loadLogosConfig({
			filesystem: fs,
			now,
			projectRoot: '/project',
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.createdDefault).toBe(false);
			expect(result.config.activeProfileId).toBe('my-profile');
			expect(result.config.version).toBe(1);
			expect(result.config.createdAt).toBe('2025-01-01T00:00:00Z');
			expect(result.config.updatedAt).toBe('2025-06-01T00:00:00Z');
		}
	});

	it('round-trips a config through save/load', async () => {
		const fs = createFakeFilesystem();

		const config: LogosConfig = {
			activeProfileId: 'round-trip',
			createdAt: '2026-01-01T00:00:00Z',
			metadata: { source: 'test' },
			updatedAt: '2026-01-02T00:00:00Z',
			version: 1,
		};

		await saveLogosConfig({
			config,
			filesystem: fs,
			projectRoot: '/project',
		});

		const result = await loadLogosConfig({
			filesystem: fs,
			now,
			projectRoot: '/project',
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.config.activeProfileId).toBe(config.activeProfileId);
			expect(result.config.createdAt).toBe(config.createdAt);
			expect(result.config.updatedAt).toBe(config.updatedAt);
			expect(result.config.metadata).toEqual(config.metadata);
			expect(result.config.version).toBe(config.version);
		}
	});

	it('returns errors for invalid YAML', async () => {
		const fs = createFakeFilesystem();

		// Write invalid YAML directly (bypass saveConfig which always writes valid YAML).
		const configPath = getLogosConfigPath('/project');
		await fs.ensureDirectory(getLogosRuntimeDir('/project'));
		await fs.writeTextFile({
			content: '{ invalid: yaml: here',
			overwrite: true,
			path: configPath,
		});

		const result = await loadLogosConfig({
			filesystem: fs,
			now,
			projectRoot: '/project',
		});

		expect(result.ok).toBe(false);
	});

	it('returns errors for invalid config values', async () => {
		const fs = createFakeFilesystem();

		// Write valid YAML but with invalid activeProfileId.
		const configPath = getLogosConfigPath('/project');
		await fs.ensureDirectory(getLogosRuntimeDir('/project'));
		await fs.writeTextFile({
			content: 'version: 1\nactiveProfileId: BAD_PROFILE\n',
			overwrite: true,
			path: configPath,
		});

		const result = await loadLogosConfig({
			filesystem: fs,
			now,
			projectRoot: '/project',
		});

		expect(result.ok).toBe(false);
	});

	it('handles empty YAML gracefully', async () => {
		const fs = createFakeFilesystem();
		const configPath = getLogosConfigPath('/project');
		await fs.ensureDirectory(getLogosRuntimeDir('/project'));
		await fs.writeTextFile({
			content: '',
			overwrite: true,
			path: configPath,
		});

		const result = await loadLogosConfig({
			filesystem: fs,
			now,
			projectRoot: '/project',
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.config.activeProfileId).toBe(DEFAULT_PROFILE_ID);
			expect(result.warnings.length).toBeGreaterThan(0);
		}
	});
});

describe('saveLogosConfig', () => {
	it('writes YAML through the filesystem port', async () => {
		const fs = createFakeFilesystem();

		const config: LogosConfig = {
			activeProfileId: 'test-write',
			createdAt: '2026-01-01T00:00:00Z',
			updatedAt: '2026-01-01T00:00:00Z',
			version: 1,
		};

		await saveLogosConfig({
			config,
			filesystem: fs,
			projectRoot: '/project',
		});

		const configPath = getLogosConfigPath('/project');
		expect(await fs.fileExists({ path: configPath })).toBe(true);

		const content = await fs.readTextFile(configPath);
		// Verify the YAML contains the expected keys.
		expect(content.content).toContain('activeProfileId: test-write');
		expect(content.content).toContain('version: 1');
	});

	it('creates the .logos/ directory if missing', async () => {
		const fs = createFakeFilesystem();

		const config: LogosConfig = {
			activeProfileId: 'standard',
			createdAt: '2026-01-01T00:00:00Z',
			updatedAt: '2026-01-01T00:00:00Z',
			version: 1,
		};

		// The directory doesn't exist yet — no ensureDirectory call made.
		await saveLogosConfig({
			config,
			filesystem: fs,
			projectRoot: '/project',
		});

		// The save should have succeeded (ensureDirectory is a no-op in the fake,
		// but the test should not crash).
		const configPath = getLogosConfigPath('/project');
		expect(await fs.fileExists({ path: configPath })).toBe(true);
	});

	it('refuses to write outside project root', async () => {
		const fs = createFakeFilesystem();

		const config: LogosConfig = {
			activeProfileId: 'standard',
			createdAt: '2026-01-01T00:00:00Z',
			updatedAt: '2026-01-01T00:00:00Z',
			version: 1,
		};

		// Empty project root should be caught by path safety.
		await expect(
			saveLogosConfig({
				config,
				filesystem: fs,
				projectRoot: '',
			}),
		).rejects.toThrow('outside project root');
	});

	it('writes config with metadata when present', async () => {
		const fs = createFakeFilesystem();

		const config: LogosConfig = {
			activeProfileId: 'standard',
			createdAt: '2026-01-01T00:00:00Z',
			metadata: { editor: 'pi' },
			updatedAt: '2026-01-01T00:00:00Z',
			version: 1,
		};

		await saveLogosConfig({
			config,
			filesystem: fs,
			projectRoot: '/project',
		});

		const content = await fs.readTextFile(getLogosConfigPath('/project'));
		expect(content.content).toContain('metadata:');
		expect(content.content).toContain('editor: pi');
	});
});
