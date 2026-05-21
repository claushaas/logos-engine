/** Package and bundled profile resolution tests */

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
	resolveActiveProfileRuntimePaths,
	resolveBundledStandardProfileRoot,
} from '../src/profiles/profile-runtime-paths.js';

// ---------------------------------------------------------------------------
// Bundled Standard profile resolution
// ---------------------------------------------------------------------------

describe('packaged/bundled Standard profile resolution', () => {
	it('resolveBundledStandardProfileRoot returns a valid path', () => {
		const root = resolveBundledStandardProfileRoot();
		expect(existsSync(root)).toBe(true);
	});

	it('bundled profile root contains profiles/standard/docs.yml', () => {
		const root = resolveBundledStandardProfileRoot();
		const registry = resolve(root, 'docs.yml');
		expect(existsSync(registry)).toBe(true);
	});

	it('bundled profile root contains executive/', () => {
		const root = resolveBundledStandardProfileRoot();
		const execRoot = resolve(root, 'executive');
		expect(existsSync(execRoot)).toBe(true);
	});

	it('bundled profile executive-generation.yml exists', () => {
		const root = resolveBundledStandardProfileRoot();
		const configPath = resolve(root, 'executive', 'executive-generation.yml');
		expect(existsSync(configPath)).toBe(true);
	});

	it('bundled profile executive-plan.schema.json exists', () => {
		const root = resolveBundledStandardProfileRoot();
		const schemaPath = resolve(root, 'executive', 'executive-plan.schema.json');
		expect(existsSync(schemaPath)).toBe(true);
	});

	it('bundled profile executive/mappings/ exists', () => {
		const root = resolveBundledStandardProfileRoot();
		const mappingsDir = resolve(root, 'executive', 'mappings');
		expect(existsSync(mappingsDir)).toBe(true);
	});

	it('bundled profile executive/templates/ exists', () => {
		const root = resolveBundledStandardProfileRoot();
		const templatesDir = resolve(root, 'executive', 'templates');
		expect(existsSync(templatesDir)).toBe(true);
	});

	it('runtime paths resolve from bundled standard in any directory', () => {
		const paths = resolveActiveProfileRuntimePaths({
			profileId: 'standard',
			projectRoot: '/tmp/some-random-dir',
		});

		expect(paths.source).toBe('bundled');
		expect(paths.profileRoot).toContain('profiles/standard');
		expect(existsSync(paths.executiveGenerationConfigPath)).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// Hard-code regression: production Executive runtime
// ---------------------------------------------------------------------------

describe('hard-code regression — no Standard Executive paths in production', () => {
	it('resolveActiveProfileRuntimePaths does not hard-code profiles/standard/executive for local profiles', () => {
		// With an explicit profile root, the executive paths should not contain standard
		const paths = resolveActiveProfileRuntimePaths({
			profileId: 'test-local',
			profileRoot: 'my-custom-profile',
			projectRoot: '/tmp/test-regression',
			requireExecutive: true,
		});

		// The executive paths should reference the provided root, not standard
		expect(paths.executiveRoot).toContain('my-custom-profile');
		expect(paths.executiveRoot).not.toContain('profiles/standard');
		expect(paths.executiveGenerationConfigPath).toContain('my-custom-profile');
		expect(paths.executiveGenerationConfigPath).not.toContain(
			'profiles/standard',
		);
		expect(paths.executiveSchemaPath).toContain('my-custom-profile');
		expect(paths.executiveSchemaPath).not.toContain('profiles/standard');
		expect(paths.executiveMappingsDirectory).toContain('my-custom-profile');
		expect(paths.executiveMappingsDirectory).not.toContain('profiles/standard');
		expect(paths.executiveTemplatesDirectory).toContain('my-custom-profile');
		expect(paths.executiveTemplatesDirectory).not.toContain(
			'profiles/standard',
		);
	});

	it('safe display paths are relative, never absolute', () => {
		const paths = resolveActiveProfileRuntimePaths({
			profileId: 'standard',
			projectRoot: '/tmp/display-test',
		});

		for (const [_key, value] of Object.entries(paths.safeDisplay)) {
			expect(value.startsWith('/')).toBe(false);
			expect(value.startsWith('C:')).toBe(false);
			expect(typeof value).toBe('string');
		}
	});

	it('safe display paths do not leak internal package paths', () => {
		const paths = resolveActiveProfileRuntimePaths({
			profileId: 'standard',
			projectRoot: '/tmp/display-test',
		});

		// Safe display should be a reasonable relative identifier,
		// not containing dist/ or node_modules/
		const allValues = Object.values(paths.safeDisplay).join(' ');
		expect(allValues).not.toContain('node_modules');
	});
});
