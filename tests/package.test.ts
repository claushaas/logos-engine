import { describe, expect, it } from 'vitest';
import {
	LOGOS_BINARY_NAME,
	PACKAGE_NAME,
	PACKAGE_VERSION,
	getPackageMetadata,
} from '../src/index.js';

describe('package metadata', () => {
	it('PACKAGE_NAME is a non-empty string', () => {
		expect(typeof PACKAGE_NAME).toBe('string');
		expect(PACKAGE_NAME.length).toBeGreaterThan(0);
	});

	it('LOGOS_BINARY_NAME equals "logos"', () => {
		expect(LOGOS_BINARY_NAME).toBe('logos');
	});

	it('getPackageMetadata() returns expected stable fields', () => {
		const meta = getPackageMetadata();
		expect(meta).toHaveProperty('name', PACKAGE_NAME);
		expect(meta).toHaveProperty('version', PACKAGE_VERSION);
		expect(meta).toHaveProperty('binaryName', LOGOS_BINARY_NAME);
	});

	it('package metadata does not require workspace state', () => {
		const meta = getPackageMetadata();
		expect(meta).toBeDefined();
		expect(meta.name).toBe('logos-engine');
	});
});
