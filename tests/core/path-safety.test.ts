import { describe, expect, it } from 'vitest';
import { checkPathInsideProject } from '../../src/core/fs/path-safety.js';

describe('checkPathInsideProject', () => {
	it('marks a path inside the project root as safe', () => {
		const result = checkPathInsideProject({
			projectRoot: '/repo/app',
			targetPath: 'docs/file.md',
		});

		expect(result.safe).toBe(true);
		if (result.safe) {
			expect(result.relativePath).toBe('docs/file.md');
		}
	});

	it('marks a nested path inside the project root as safe', () => {
		const result = checkPathInsideProject({
			projectRoot: '/repo/app',
			targetPath: 'src/core/nested/deep.txt',
		});

		expect(result.safe).toBe(true);
		if (result.safe) {
			expect(result.relativePath).toBe('src/core/nested/deep.txt');
		}
	});

	it('marks the project root itself as safe', () => {
		const result = checkPathInsideProject({
			projectRoot: '/repo/app',
			targetPath: '.',
		});

		expect(result.safe).toBe(true);
		if (result.safe) {
			expect(result.relativePath).toBe('');
		}
	});

	it('marks path traversal outside root as unsafe', () => {
		const result = checkPathInsideProject({
			projectRoot: '/repo/app',
			targetPath: '../outside.txt',
		});

		expect(result.safe).toBe(false);
		if (!result.safe) {
			expect(result.reason).toBe('outside_project_root');
		}
	});

	it('marks sibling prefix attack as unsafe', () => {
		const result = checkPathInsideProject({
			projectRoot: '/repo/app',
			targetPath: '/repo/app-malicious/file.txt',
		});

		expect(result.safe).toBe(false);
		if (!result.safe) {
			expect(result.reason).toBe('outside_project_root');
		}
	});

	it('marks empty project root as unsafe', () => {
		const result = checkPathInsideProject({
			projectRoot: '',
			targetPath: 'file.txt',
		});

		expect(result.safe).toBe(false);
		if (!result.safe) {
			expect(result.reason).toBe('invalid_project_root');
		}
	});

	it('marks empty target path as unsafe', () => {
		const result = checkPathInsideProject({
			projectRoot: '/repo/app',
			targetPath: '',
		});

		expect(result.safe).toBe(false);
		if (!result.safe) {
			expect(result.reason).toBe('empty_path');
		}
	});

	it('marks absolute target outside root as unsafe', () => {
		const result = checkPathInsideProject({
			projectRoot: '/repo/app',
			targetPath: '/etc/passwd',
		});

		expect(result.safe).toBe(false);
		if (!result.safe) {
			expect(result.reason).toBe('outside_project_root');
		}
	});
});
