/**
 * Tests for profile resolution (Step 2.2).
 *
 * Covers:
 * - standard resolves to profiles/standard/.
 * - A future custom profile id resolves generically.
 * - Missing profile directory returns profile_not_found.
 * - Invalid profile id returns profile_id_invalid.
 * - Path traversal profile ids are rejected.
 * - Resolved profile paths are inside project root.
 * - Resolver does not hardcode profiles/standard except through default id.
 */

import path from 'node:path';
import { describe, expect, it } from 'vitest';

import type {
	DirectoryEntry,
	DirectoryListInput,
	FileExistsInput,
	FileReadResult,
	FileWriteInput,
	LogosFilesystem,
} from '../../src/core/ports/filesystem.js';
import {
	getProfileRoot,
	getProfilesRoot,
	PROFILES_DIR_NAME,
	resolveActiveProfile,
} from '../../src/core/profiles/profile-resolver.js';

// ---------------------------------------------------------------------------
// Fake filesystem
// ---------------------------------------------------------------------------

/**
 * In-memory fake filesystem for profile resolution tests.
 *
 * - `listDirectory` throws if the directory was not registered via
 *   `addDirectory` — this lets us distinguish "directory exists" from
 *   "directory does not exist".
 * - `fileExists` checks the files map.
 * - `readTextFile` is included for completeness but not needed by the resolver.
 */
function createFakeFilesystem(): LogosFilesystem & {
	addDirectory(dir: string): void;
	addFile(filePath: string, content: string): void;
	addStandardProfile(): void;
	addProfile(id: string, options?: { omitPaths?: string[] }): void;
} {
	const files = new Map<string, string>();
	const dirs = new Set<string>();

	function addDirectory(dir: string): void {
		// Normalise to remove trailing slash for consistent lookups.
		const normalised = dir.replace(/\/$/, '');
		dirs.add(normalised);

		// Also register all parent directories.
		let parent = path.dirname(normalised);
		while (parent !== normalised && parent !== '.' && parent !== '/') {
			dirs.add(parent);
			parent = path.dirname(parent);
		}
		// Register the root
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
		// Ensure parent directory exists.
		const parent = path.dirname(filePath);
		addDirectory(parent);
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
		addProfile('standard');
	}

	function addProfile(id: string, options?: { omitPaths?: string[] }): void {
		const omit = new Set(options?.omitPaths ?? []);
		const root = `/project/${PROFILES_DIR_NAME}/${id}`;

		// Register directories.
		addDirectory(root);
		for (const d of STANDARD_REQUIRED_DIRS) {
			if (!omit.has(d) && !omit.has(`${d}/`)) {
				addDirectory(path.join(root, d));
			}
		}

		// Register files.
		for (const f of STANDARD_REQUIRED_PATHS) {
			if (!omit.has(f.path)) {
				addFile(path.join(root, f.path), f.content);
			}
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
						entries.push({ kind: 'file', path: path.join(prefix, top) });
					}
				}
			}

			for (const dirPath of dirs) {
				if (dirPath.startsWith(`${prefix}/`)) {
					const rel = dirPath.slice(prefix.length + 1);
					const top = rel.split('/')[0];
					if (top !== undefined && !seen.has(top)) {
						seen.add(top);
						entries.push({ kind: 'directory', path: path.join(prefix, top) });
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
			const parent = path.dirname(input.path);
			addDirectory(parent);
		},
	};

	return { ...fs, addDirectory, addFile, addProfile, addStandardProfile };
}

// ---------------------------------------------------------------------------
// Path helper tests
// ---------------------------------------------------------------------------

describe('getProfilesRoot', () => {
	it('joins projectRoot with "profiles"', () => {
		expect(getProfilesRoot('/my/project')).toBe('/my/project/profiles');
	});

	it('handles trailing slash in projectRoot', () => {
		expect(getProfilesRoot('/my/project/')).toBe('/my/project/profiles');
	});
});

describe('getProfileRoot', () => {
	it('joins projectRoot, profiles, and profileId', () => {
		expect(
			getProfileRoot({ profileId: 'standard', projectRoot: '/my/project' }),
		).toBe('/my/project/profiles/standard');
	});

	it('works with custom profile id', () => {
		expect(
			getProfileRoot({
				profileId: 'custom-profile',
				projectRoot: '/my/project',
			}),
		).toBe('/my/project/profiles/custom-profile');
	});
});

describe('PROFILES_DIR_NAME', () => {
	it('is "profiles"', () => {
		expect(PROFILES_DIR_NAME).toBe('profiles');
	});
});

// ---------------------------------------------------------------------------
// Resolution tests
// ---------------------------------------------------------------------------

describe('resolveActiveProfile', () => {
	// ---- 1. standard resolves to profiles/standard/ ----
	it('resolves standard to profiles/standard/', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile();

		const result = await resolveActiveProfile({
			activeProfileId: 'standard',
			filesystem: fs,
			projectRoot: '/project',
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.profile.profileId).toBe('standard');
			expect(result.profile.profileRoot).toBe('/project/profiles/standard');
			expect(result.profile.docsPath).toBe(
				'/project/profiles/standard/docs.yml',
			);
			expect(result.profile.documentSchemaPath).toBe(
				'/project/profiles/standard/document.schema.yml',
			);
			expect(result.profile.phasesRoot).toBe(
				'/project/profiles/standard/phases',
			);
			expect(result.profile.executiveRoot).toBe(
				'/project/profiles/standard/executive',
			);
		}
	});

	// ---- 2. A future custom profile id resolves generically ----
	it('resolves a future custom profile id generically', async () => {
		const fs = createFakeFilesystem();
		fs.addProfile('custom-profile');

		const result = await resolveActiveProfile({
			activeProfileId: 'custom-profile',
			filesystem: fs,
			projectRoot: '/project',
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.profile.profileId).toBe('custom-profile');
			expect(result.profile.profileRoot).toBe(
				'/project/profiles/custom-profile',
			);
		}
	});

	// ---- 3. Missing profile directory returns profile_not_found ----
	it('returns profile_not_found when directory does not exist', async () => {
		const fs = createFakeFilesystem();
		// Do not add any profile.

		const result = await resolveActiveProfile({
			activeProfileId: 'missing',
			filesystem: fs,
			projectRoot: '/project',
		});

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.errors.length).toBeGreaterThan(0);
			expect(result.errors.some((e) => e.code === 'profile_not_found')).toBe(
				true,
			);
		}
	});

	it('returns profile_not_found for valid id with no directory', async () => {
		const fs = createFakeFilesystem();
		// Only add standard, not 'nonexistent'.
		fs.addStandardProfile();

		const result = await resolveActiveProfile({
			activeProfileId: 'nonexistent',
			filesystem: fs,
			projectRoot: '/project',
		});

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.errors.some((e) => e.code === 'profile_not_found')).toBe(
				true,
			);
		}
	});

	// ---- 4. Invalid profile id returns profile_id_invalid ----
	it('returns profile_id_invalid for uppercase id', async () => {
		const fs = createFakeFilesystem();

		const result = await resolveActiveProfile({
			activeProfileId: 'INVALID',
			filesystem: fs,
			projectRoot: '/project',
		});

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.errors.some((e) => e.code === 'profile_id_invalid')).toBe(
				true,
			);
		}
	});

	it('returns profile_id_invalid for empty id', async () => {
		const fs = createFakeFilesystem();

		const result = await resolveActiveProfile({
			activeProfileId: '',
			filesystem: fs,
			projectRoot: '/project',
		});

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.errors.some((e) => e.code === 'profile_id_invalid')).toBe(
				true,
			);
		}
	});

	// ---- 5. Profile id with ../standard does not escape project root ----
	it('rejects path traversal profile id via syntax validation', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile();

		const result = await resolveActiveProfile({
			activeProfileId: '../standard',
			filesystem: fs,
			projectRoot: '/project',
		});

		expect(result.ok).toBe(false);
		if (!result.ok) {
			// Should fail at id validation stage (path_traversal reason).
			const hasInvalid =
				result.errors.some((e) => e.code === 'profile_id_invalid') ||
				result.errors.some((e) => e.code === 'profile_path_unsafe');
			expect(hasInvalid).toBe(true);
		}
	});

	it('rejects slash-containing profile id', async () => {
		const fs = createFakeFilesystem();

		const result = await resolveActiveProfile({
			activeProfileId: 'my/profile',
			filesystem: fs,
			projectRoot: '/project',
		});

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.errors.some((e) => e.code === 'profile_id_invalid')).toBe(
				true,
			);
		}
	});

	// ---- 6. Resolved profile paths are inside project root ----
	it('resolved profile paths are inside project root', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile();

		const result = await resolveActiveProfile({
			activeProfileId: 'standard',
			filesystem: fs,
			projectRoot: '/project',
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.profile.profileRoot.startsWith('/project/')).toBe(true);
			expect(result.profile.docsPath.startsWith('/project/')).toBe(true);
			expect(result.profile.phasesRoot.startsWith('/project/')).toBe(true);
			expect(result.profile.executiveRoot.startsWith('/project/')).toBe(true);
		}
	});

	// ---- 7. Resolver does not hardcode profiles/standard ----
	it('does not hardcode profiles/standard — works with any valid id', async () => {
		const fs = createFakeFilesystem();
		fs.addProfile('any-profile');

		const result = await resolveActiveProfile({
			activeProfileId: 'any-profile',
			filesystem: fs,
			projectRoot: '/project',
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.profile.profileId).toBe('any-profile');
			expect(result.profile.profileRoot).toBe('/project/profiles/any-profile');
		}
	});

	// ---- Additional: overlong id ----
	it('returns profile_id_invalid for overlong id', async () => {
		const fs = createFakeFilesystem();
		const longId = `a${'x'.repeat(80)}`; // 81 chars, max is 80

		const result = await resolveActiveProfile({
			activeProfileId: longId,
			filesystem: fs,
			projectRoot: '/project',
		});

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.errors.some((e) => e.code === 'profile_id_invalid')).toBe(
				true,
			);
		}
	});

	// ---- Additional: profile_path_unsafe with empty projectRoot ----
	it('returns profile_path_unsafe for empty projectRoot', async () => {
		const fs = createFakeFilesystem();

		const result = await resolveActiveProfile({
			activeProfileId: 'standard',
			filesystem: fs,
			projectRoot: '',
		});

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.errors.some((e) => e.code === 'profile_path_unsafe')).toBe(
				true,
			);
		}
	});
});
