/**
 * Documentation Root Model tests — types, diagnostic codes, and helpers.
 *
 * Phase 6: Documentation Root Configuration — Root model tests.
 */

import { describe, expect, it } from 'vitest';
import { DOCUMENTATION_ROOT_DIAGNOSTIC_CODES } from '../src/workspace/documentation-root-model.js';

describe('documentation root model', () => {
	describe('diagnostic codes', () => {
		it('are stable strings', () => {
			expect(DOCUMENTATION_ROOT_DIAGNOSTIC_CODES.ROOT_CHANGE_APPLIED).toBe(
				'LOGOS_ROOT_CHANGED',
			);
			expect(DOCUMENTATION_ROOT_DIAGNOSTIC_CODES.ROOT_CHANGE_CANCELLED).toBe(
				'LOGOS_ROOT_CHANGE_CANCELLED',
			);
			expect(DOCUMENTATION_ROOT_DIAGNOSTIC_CODES.ROOT_PATH_TRAVERSAL).toBe(
				'LOGOS_ROOT_PATH_TRAVERSAL',
			);
			expect(DOCUMENTATION_ROOT_DIAGNOSTIC_CODES.ROOT_OUTSIDE_PROJECT).toBe(
				'LOGOS_ROOT_OUTSIDE_PROJECT',
			);
			expect(DOCUMENTATION_ROOT_DIAGNOSTIC_CODES.ROOT_RESERVED_PATH).toBe(
				'LOGOS_ROOT_RESERVED_PATH',
			);
			expect(
				DOCUMENTATION_ROOT_DIAGNOSTIC_CODES.ROOT_OVERLAPS_WORKSPACE_STATE,
			).toBe('LOGOS_ROOT_OVERLAPS_WORKSPACE_STATE');
			expect(DOCUMENTATION_ROOT_DIAGNOSTIC_CODES.ROOT_SYMLINK_ESCAPE).toBe(
				'LOGOS_ROOT_SYMLINK_ESCAPE',
			);
		});

		it('are all unique', () => {
			const values = Object.values(DOCUMENTATION_ROOT_DIAGNOSTIC_CODES);
			const unique = new Set(values);
			expect(unique.size).toBe(values.length);
		});

		it('all start with LOGOS_ROOT_', () => {
			for (const code of Object.values(DOCUMENTATION_ROOT_DIAGNOSTIC_CODES)) {
				expect(code).toMatch(/^LOGOS_ROOT_/);
			}
		});
	});
});
