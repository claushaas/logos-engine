/**
 * Tests for profile required-contract validation (Step 2.2).
 *
 * Covers each required path individually:
 * - Missing docs.yml returns profile_invalid.
 * - Missing document.schema.yml returns profile_invalid.
 * - Missing phases/ returns profile_invalid.
 * - Missing executive/ returns profile_invalid.
 * - Missing executive/executive-generation.yml returns profile_invalid.
 * - Missing executive/executive-plan.schema.json returns profile_invalid.
 * - Missing executive/mappings/ returns profile_invalid.
 * - Missing executive/templates/ returns profile_invalid.
 * - Complete required shape resolves successfully.
 * - Errors include the missing path or a useful label.
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
	getStandardRequiredPaths,
	validateProfileRequiredPaths,
} from '../../src/core/profiles/profile-contracts.js';
import { resolveActiveProfile } from '../../src/core/profiles/profile-resolver.js';

// ---------------------------------------------------------------------------
// Fake filesystem
// ---------------------------------------------------------------------------

function createFakeFilesystem(): LogosFilesystem & {
	addDirectory(dir: string): void;
	addFile(filePath: string, content: string): void;
	addStandardProfile(options?: { omitPaths?: string[] }): void;
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

	const STANDARD_REQUIRED_FILES = [
		'docs.yml',
		'document.schema.yml',
		'executive/executive-generation.yml',
		'executive/executive-plan.schema.json',
	];

	const STANDARD_REQUIRED_DIRS = [
		'phases',
		'executive',
		'executive/mappings',
		'executive/templates',
	];

	function addStandardProfile(options?: { omitPaths?: string[] }): void {
		const omit = new Set(options?.omitPaths ?? []);
		const root = '/project/profiles/standard';

		addDirectory(root);
		for (const d of STANDARD_REQUIRED_DIRS) {
			if (!omit.has(d) && !omit.has(`${d}/`)) {
				addDirectory(path.join(root, d));
			}
		}
		for (const f of STANDARD_REQUIRED_FILES) {
			if (!omit.has(f)) {
				addFile(path.join(root, f), '# content');
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
					const top = filePath.slice(prefix.length + 1).split('/')[0];
					if (top !== undefined && !seen.has(top)) {
						seen.add(top);
						entries.push({ kind: 'file', path: path.join(prefix, top) });
					}
				}
			}
			for (const dirPath of dirs) {
				if (dirPath.startsWith(`${prefix}/`)) {
					const top = dirPath.slice(prefix.length + 1).split('/')[0];
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
			if (content === undefined) throw new Error(`ENOENT: ${p}`);
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
// Tests for validateProfileRequiredPaths
// ---------------------------------------------------------------------------

describe('validateProfileRequiredPaths', () => {
	// ---- 1. Missing docs.yml ----
	it('returns profile_invalid when docs.yml is missing', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile({ omitPaths: ['docs.yml'] });

		const requiredPaths = getStandardRequiredPaths(
			'/project/profiles/standard',
		);
		const errors = await validateProfileRequiredPaths({
			filesystem: fs,
			requiredPaths,
		});

		expect(errors.length).toBeGreaterThan(0);
		const docsError = errors.find((e) => e.path?.endsWith('docs.yml'));
		expect(docsError).toBeDefined();
		expect(docsError?.code).toBe('profile_invalid');
	});

	// ---- 2. Missing document.schema.yml ----
	it('returns profile_invalid when document.schema.yml is missing', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile({ omitPaths: ['document.schema.yml'] });

		const requiredPaths = getStandardRequiredPaths(
			'/project/profiles/standard',
		);
		const errors = await validateProfileRequiredPaths({
			filesystem: fs,
			requiredPaths,
		});

		const schemaError = errors.find((e) =>
			e.path?.endsWith('document.schema.yml'),
		);
		expect(schemaError).toBeDefined();
		expect(schemaError?.code).toBe('profile_invalid');
	});

	// ---- 3. Missing phases/ ----
	it('returns profile_invalid when phases/ is missing', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile({ omitPaths: ['phases'] });

		const requiredPaths = getStandardRequiredPaths(
			'/project/profiles/standard',
		);
		const errors = await validateProfileRequiredPaths({
			filesystem: fs,
			requiredPaths,
		});

		const phasesError = errors.find((e) => e.path?.endsWith('phases'));
		expect(phasesError).toBeDefined();
		expect(phasesError?.code).toBe('profile_invalid');
	});

	// ---- 4. Missing executive/ ----
	it('returns profile_invalid when executive/ is missing', async () => {
		const fs = createFakeFilesystem();
		// Omit the executive directory itself AND all its children so
		// the directory existence check fails at the top level.
		fs.addStandardProfile({
			omitPaths: [
				'executive',
				'executive/executive-generation.yml',
				'executive/executive-plan.schema.json',
				'executive/mappings',
				'executive/templates',
			],
		});

		const requiredPaths = getStandardRequiredPaths(
			'/project/profiles/standard',
		);
		const errors = await validateProfileRequiredPaths({
			filesystem: fs,
			requiredPaths,
		});

		const execError = errors.find(
			(e) => e.path?.endsWith('executive') && !e.path?.includes('executive/'),
		);
		expect(execError).toBeDefined();
		expect(execError?.code).toBe('profile_invalid');
	});

	// ---- 5. Missing executive/executive-generation.yml ----
	it('returns profile_invalid when executive-generation.yml is missing', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile({
			omitPaths: ['executive/executive-generation.yml'],
		});

		const requiredPaths = getStandardRequiredPaths(
			'/project/profiles/standard',
		);
		const errors = await validateProfileRequiredPaths({
			filesystem: fs,
			requiredPaths,
		});

		const genError = errors.find((e) =>
			e.path?.endsWith('executive-generation.yml'),
		);
		expect(genError).toBeDefined();
		expect(genError?.code).toBe('profile_invalid');
	});

	// ---- 6. Missing executive/executive-plan.schema.json ----
	it('returns profile_invalid when executive-plan.schema.json is missing', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile({
			omitPaths: ['executive/executive-plan.schema.json'],
		});

		const requiredPaths = getStandardRequiredPaths(
			'/project/profiles/standard',
		);
		const errors = await validateProfileRequiredPaths({
			filesystem: fs,
			requiredPaths,
		});

		const planError = errors.find((e) =>
			e.path?.endsWith('executive-plan.schema.json'),
		);
		expect(planError).toBeDefined();
		expect(planError?.code).toBe('profile_invalid');
	});

	// ---- 7. Missing executive/mappings/ ----
	it('returns profile_invalid when executive/mappings/ is missing', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile({ omitPaths: ['executive/mappings'] });

		const requiredPaths = getStandardRequiredPaths(
			'/project/profiles/standard',
		);
		const errors = await validateProfileRequiredPaths({
			filesystem: fs,
			requiredPaths,
		});

		const mappingsError = errors.find((e) =>
			e.path?.endsWith('executive/mappings'),
		);
		expect(mappingsError).toBeDefined();
		expect(mappingsError?.code).toBe('profile_invalid');
	});

	// ---- 8. Missing executive/templates/ ----
	it('returns profile_invalid when executive/templates/ is missing', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile({ omitPaths: ['executive/templates'] });

		const requiredPaths = getStandardRequiredPaths(
			'/project/profiles/standard',
		);
		const errors = await validateProfileRequiredPaths({
			filesystem: fs,
			requiredPaths,
		});

		const templatesError = errors.find((e) =>
			e.path?.endsWith('executive/templates'),
		);
		expect(templatesError).toBeDefined();
		expect(templatesError?.code).toBe('profile_invalid');
	});

	// ---- 9. Complete required shape resolves successfully ----
	it('returns no errors for a complete profile', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile();

		const requiredPaths = getStandardRequiredPaths(
			'/project/profiles/standard',
		);
		const errors = await validateProfileRequiredPaths({
			filesystem: fs,
			requiredPaths,
		});

		expect(errors).toEqual([]);
	});

	// ---- 10. Errors include the missing path or a useful label ----
	it('errors include path information', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile({ omitPaths: ['docs.yml', 'phases'] });

		const requiredPaths = getStandardRequiredPaths(
			'/project/profiles/standard',
		);
		const errors = await validateProfileRequiredPaths({
			filesystem: fs,
			requiredPaths,
		});

		expect(errors.length).toBe(2);

		// Each error should have a path.
		for (const error of errors) {
			expect(error.path).toBeDefined();
			expect(error.path?.length).toBeGreaterThan(0);
		}

		// Each error should have a message mentioning the missing item.
		const messages = errors.map((e) => e.message).join(' ');
		expect(messages.toLowerCase()).toMatch(/missing required/);
	});
});

// ---------------------------------------------------------------------------
// Integration via resolveActiveProfile
// ---------------------------------------------------------------------------

describe('resolveActiveProfile — contract validation', () => {
	it('returns ok when all required contracts exist', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile();

		const result = await resolveActiveProfile({
			activeProfileId: 'standard',
			filesystem: fs,
			projectRoot: '/project',
		});

		expect(result.ok).toBe(true);
	});

	it('returns profile_invalid when contracts are missing', async () => {
		const fs = createFakeFilesystem();
		fs.addStandardProfile({ omitPaths: ['docs.yml', 'phases'] });

		const result = await resolveActiveProfile({
			activeProfileId: 'standard',
			filesystem: fs,
			projectRoot: '/project',
		});

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.errors.some((e) => e.code === 'profile_invalid')).toBe(
				true,
			);
			// Should have at least 2 errors (docs.yml + phases)
			expect(result.errors.length).toBeGreaterThanOrEqual(2);
		}
	});
});

// ---------------------------------------------------------------------------
// getStandardRequiredPaths shape
// ---------------------------------------------------------------------------

describe('getStandardRequiredPaths', () => {
	it('returns 8 required paths', () => {
		const paths = getStandardRequiredPaths('/project/profiles/standard');
		expect(paths.length).toBe(8);
	});

	it('includes exactly 4 files and 4 directories', () => {
		const paths = getStandardRequiredPaths('/project/profiles/standard');
		expect(paths.filter((p) => p.kind === 'file').length).toBe(4);
		expect(paths.filter((p) => p.kind === 'directory').length).toBe(4);
	});

	it('all paths start with the profile root', () => {
		const paths = getStandardRequiredPaths('/project/profiles/standard');
		for (const p of paths) {
			expect(p.path.startsWith('/project/profiles/standard/')).toBe(true);
		}
	});

	it('every path has a non-empty label', () => {
		const paths = getStandardRequiredPaths('/project/profiles/standard');
		for (const p of paths) {
			expect(p.label.length).toBeGreaterThan(0);
		}
	});
});
