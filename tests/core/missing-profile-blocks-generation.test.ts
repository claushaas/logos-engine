import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { createLogosCore } from '../../src/core/api.js';
import { getLogosConfigPath } from '../../src/core/config/config-paths.js';
import type {
	DirectoryEntry,
	DirectoryListInput,
	FileExistsInput,
	FileReadResult,
	FileWriteInput,
	LogosFilesystem,
} from '../../src/core/ports/filesystem.js';
import { PROFILES_DIR_NAME } from '../../src/core/profiles/profile-resolver.js';

// ---------------------------------------------------------------------------
// Fake filesystem
// ---------------------------------------------------------------------------

function createFakeFilesystem(): LogosFilesystem & {
	addDirectory(dir: string): void;
	addFile(filePath: string, content: string): void;
	addStandardProfile(): void;
} {
	const files = new Map<string, string>();
	const dirs = new Set<string>();

	function addDirectory(dir: string): void {
		const normalised = dir.replace(/\/$/, '');
		dirs.add(normalised);
		let parent = path.dirname(normalised);
		while (parent !== normalised && parent !== '.' && parent !== '/') {
			dirs.add(parent);
			parent = path.dirname(parent);
		}
		if (normalised.startsWith('/')) {
			let p = path.dirname(normalised);
			while (p !== '/' && p !== '.') {
				dirs.add(p);
				p = path.dirname(p);
			}
			dirs.add('/');
		}
	}

	function addFile(filePath: string, content: string): void {
		files.set(filePath, content);
		addDirectory(path.dirname(filePath));
	}

	const STANDARD_REQUIRED_PATHS = [
		{ content: '# docs', path: 'docs.yml' },
		{ content: '# schema', path: 'document.schema.yml' },
		{ content: '# gen', path: 'executive/executive-generation.yml' },
		{ content: '{}', path: 'executive/executive-plan.schema.json' },
	];

	const STANDARD_REQUIRED_DIRS = [
		'phases',
		'executive',
		'executive/mappings',
		'executive/templates',
	];

	function addStandardProfile(): void {
		const root = `/project/${PROFILES_DIR_NAME}/standard`;
		addDirectory(root);
		for (const d of STANDARD_REQUIRED_DIRS) {
			addDirectory(path.join(root, d));
		}
		for (const f of STANDARD_REQUIRED_PATHS) {
			addFile(path.join(root, f.path), f.content);
		}
	}

	const fs: LogosFilesystem = {
		async ensureDirectory(p: string): Promise<void> {
			addDirectory(p);
		},

		async fileExists(input: FileExistsInput): Promise<boolean> {
			return files.has(input.path);
		},

		async listDirectory(input: DirectoryListInput): Promise<DirectoryEntry[]> {
			const prefix = input.path.replace(/\/$/, '');
			if (!dirs.has(prefix)) {
				throw new Error(`ENOENT: no such directory "${prefix}"`);
			}

			const entries: DirectoryEntry[] = [];
			const seen = new Set<string>();

			for (const filePath of files.keys()) {
				if (filePath.startsWith(`${prefix}/`)) {
					const rel = filePath.slice(prefix.length + 1);
					const top = rel.split('/')[0];
					if (top !== undefined && !seen.has(top)) {
						seen.add(top);
						entries.push({
							kind: 'file',
							path: path.join(prefix, top),
						});
					}
				}
			}

			for (const dirPath of dirs) {
				if (dirPath.startsWith(`${prefix}/`)) {
					const rel = dirPath.slice(prefix.length + 1);
					const top = rel.split('/')[0];
					if (top !== undefined && !seen.has(top)) {
						seen.add(top);
						entries.push({
							kind: 'directory',
							path: path.join(prefix, top),
						});
					}
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
			addDirectory(path.dirname(input.path));
		},
	};

	return { ...fs, addDirectory, addFile, addStandardProfile };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('missing profile blocks generate (Step 2.4)', () => {
	it('returns blocked when activeProfileId points to missing profile', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile();
		const core = createLogosCore({ filesystem: fs });

		await core.initProject({ projectRoot: '/project' });

		const configPath = getLogosConfigPath('/project');
		await fs.writeTextFile({
			content: 'version: 1\nactiveProfileId: missing-profile\n',
			overwrite: true,
			path: configPath,
		});

		const result = await core.generate({ projectRoot: '/project' });

		expect(result.status).toBe('blocked');
		expect(result.blockers.some((b) => b.code === 'profile_not_found')).toBe(
			true,
		);
		expect(result.data?.generatedPaths).toEqual([]);
	});

	it('does not return generated paths when profile is missing', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile();
		const core = createLogosCore({ filesystem: fs });

		await core.initProject({ projectRoot: '/project' });

		const configPath = getLogosConfigPath('/project');
		await fs.writeTextFile({
			content: 'version: 1\nactiveProfileId: missing-profile\n',
			overwrite: true,
			path: configPath,
		});

		const result = await core.generate({ projectRoot: '/project' });

		expect(result.data?.generatedPaths.length).toBe(0);
	});

	it('does not perform write operations when profile is missing', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile();
		const core = createLogosCore({ filesystem: fs });

		await core.initProject({ projectRoot: '/project' });

		const configPath = getLogosConfigPath('/project');
		await fs.writeTextFile({
			content: 'version: 1\nactiveProfileId: missing-profile\n',
			overwrite: true,
			path: configPath,
		});

		const beforeCount = fs.fileExists({ path: '/project/.logos/generated' });
		await core.generate({ projectRoot: '/project' });
		const afterCount = fs.fileExists({ path: '/project/.logos/generated' });

		expect(await beforeCount).toBe(false);
		expect(await afterCount).toBe(false);
	});

	it('keeps stub blocked behavior when profile is valid', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile();
		const core = createLogosCore({ filesystem: fs });

		await core.initProject({ projectRoot: '/project' });

		const result = await core.generate({ projectRoot: '/project' });

		expect(result.status).toBe('blocked');
		expect(result.blockers.some((b) => b.code === 'profile_not_found')).toBe(
			false,
		);
	});
});
