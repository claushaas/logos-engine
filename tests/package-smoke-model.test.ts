/**
 * Package Smoke Model Tests
 *
 * Step 13.4 — Package and Release Candidate Smoke
 */

import { describe, expect, it } from 'vitest';
import {
	comparePackageSmokeCheckKind,
	comparePackageSmokeStatus,
	determinePackageSmokeStatus,
	PACKAGE_SMOKE_CHECK_KIND_ORDER,
	PACKAGE_SMOKE_STATUS_ORDER,
	type PackageSmokeCheck,
	type PackageSmokeCheckKind,
	type PackageSmokeDiagnostic,
	sortPackageSmokeChecks,
	sortPackageSmokeDiagnostics,
} from '../src/release/package-smoke-model.js';

describe('package smoke model', () => {
	describe('status ordering', () => {
		it('has all required statuses', () => {
			expect(PACKAGE_SMOKE_STATUS_ORDER).toHaveProperty('pass');
			expect(PACKAGE_SMOKE_STATUS_ORDER).toHaveProperty('pass_with_warnings');
			expect(PACKAGE_SMOKE_STATUS_ORDER).toHaveProperty('blocked');
			expect(PACKAGE_SMOKE_STATUS_ORDER).toHaveProperty('failed');
			expect(PACKAGE_SMOKE_STATUS_ORDER).toHaveProperty('unknown');
		});

		it('orders blocked < failed < pass < pass_with_warnings < unknown', () => {
			const o = PACKAGE_SMOKE_STATUS_ORDER;
			expect(o.blocked).toBeLessThan(o.failed);
			expect(o.failed).toBeLessThan(o.pass);
			expect(o.pass).toBeLessThan(o.pass_with_warnings);
			expect(o.pass_with_warnings).toBeLessThan(o.unknown);
		});
	});

	describe('check kind ordering', () => {
		it('has all required check kinds', () => {
			const kinds: PackageSmokeCheckKind[] = [
				'package_metadata',
				'package_files',
				'package_exclusions',
				'build_output',
				'binary_entrypoint',
				'runtime_import',
				'bundled_profile',
				'cli_help',
				'cli_version',
				'doctor_text',
				'doctor_json',
				'doctor_dry_run',
				'security_privacy',
				'runtime_no_network',
				'runtime_no_credentials',
				'non_interactive',
				'unknown',
			];

			for (const kind of kinds) {
				expect(PACKAGE_SMOKE_CHECK_KIND_ORDER).toHaveProperty(kind);
			}
		});

		it('orders package_metadata first', () => {
			const order = PACKAGE_SMOKE_CHECK_KIND_ORDER;
			const first = Object.entries(order).sort(([, a], [, b]) => a - b)[0];
			expect(first).toBeDefined();
			expect(first?.[0]).toBe('package_metadata');
		});
	});

	describe('sortPackageSmokeChecks', () => {
		it('sorts deterministically by kind', () => {
			const checks: PackageSmokeCheck[] = [
				{
					diagnostics: [],
					kind: 'build_output',
					passed: true,
					skipped: false,
					status: 'pass',
					summary: 'ok',
				},
				{
					diagnostics: [],
					kind: 'package_metadata',
					passed: true,
					skipped: false,
					status: 'pass',
					summary: 'ok',
				},
				{
					diagnostics: [],
					kind: 'bundled_profile',
					passed: true,
					skipped: false,
					status: 'pass',
					summary: 'ok',
				},
			];

			const sorted = sortPackageSmokeChecks(checks);
			expect(sorted[0]?.kind).toBe('package_metadata');
			expect(sorted[1]?.kind).toBe('build_output');
			expect(sorted[2]?.kind).toBe('bundled_profile');
		});
	});

	describe('sortPackageSmokeDiagnostics', () => {
		it('sorts by severity first, then kind, then path, then code', () => {
			const diags: PackageSmokeDiagnostic[] = [
				{
					checkKind: 'package_metadata',
					code: 'C',
					message: 'third',
					severity: 'warning',
				},
				{
					checkKind: 'build_output',
					code: 'A',
					message: 'first',
					severity: 'error',
				},
				{
					checkKind: 'package_metadata',
					code: 'B',
					message: 'second',
					severity: 'error',
				},
			];

			const sorted = sortPackageSmokeDiagnostics(diags);
			expect(sorted[0]?.severity).toBe('error');
			expect(sorted[1]?.severity).toBe('error');
			expect(sorted[2]?.severity).toBe('warning');
			// Within error: package_metadata (order 0) before build_output (order 3)
			expect(sorted[0]?.code).toBe('B');
			expect(sorted[1]?.code).toBe('A');
		});

		it('sorts by path within same severity and kind', () => {
			const diags: PackageSmokeDiagnostic[] = [
				{
					checkKind: 'package_exclusions',
					code: 'E1',
					message: 'b',
					path: 'zzz',
					severity: 'error',
				},
				{
					checkKind: 'package_exclusions',
					code: 'E2',
					message: 'a',
					path: 'aaa',
					severity: 'error',
				},
			];

			const sorted = sortPackageSmokeDiagnostics(diags);
			expect(sorted[0]?.path).toBe('aaa');
			expect(sorted[1]?.path).toBe('zzz');
		});
	});

	describe('determinePackageSmokeStatus', () => {
		it('returns pass when all checks pass', () => {
			const checks: PackageSmokeCheck[] = [
				{
					diagnostics: [],
					kind: 'package_metadata',
					passed: true,
					skipped: false,
					status: 'pass',
					summary: 'ok',
				},
			];
			expect(determinePackageSmokeStatus(checks)).toBe('pass');
		});

		it('returns pass_with_warnings when some checks have warnings', () => {
			const checks: PackageSmokeCheck[] = [
				{
					diagnostics: [],
					kind: 'package_metadata',
					passed: true,
					skipped: false,
					status: 'pass',
					summary: 'ok',
				},
				{
					diagnostics: [],
					kind: 'package_files',
					passed: true,
					skipped: false,
					status: 'pass_with_warnings',
					summary: 'warnings',
				},
			];
			expect(determinePackageSmokeStatus(checks)).toBe('pass_with_warnings');
		});

		it('returns blocked when any check is blocked', () => {
			const checks: PackageSmokeCheck[] = [
				{
					diagnostics: [],
					kind: 'package_metadata',
					passed: false,
					skipped: false,
					status: 'blocked',
					summary: 'blocked',
				},
			];
			expect(determinePackageSmokeStatus(checks)).toBe('blocked');
		});

		it('returns blocked in strict mode when warnings present', () => {
			const checks: PackageSmokeCheck[] = [
				{
					diagnostics: [],
					kind: 'package_metadata',
					passed: true,
					skipped: false,
					status: 'pass_with_warnings',
					summary: 'warn',
				},
			];
			expect(determinePackageSmokeStatus(checks, { strict: true })).toBe(
				'blocked',
			);
		});

		it('returns blocked when any check failed', () => {
			const checks: PackageSmokeCheck[] = [
				{
					diagnostics: [],
					kind: 'package_metadata',
					passed: false,
					skipped: false,
					status: 'failed',
					summary: 'failed',
				},
			];
			expect(determinePackageSmokeStatus(checks)).toBe('blocked');
		});

		it('ignores skipped checks', () => {
			const checks: PackageSmokeCheck[] = [
				{
					diagnostics: [],
					kind: 'package_metadata',
					passed: true,
					skipped: true,
					status: 'unknown',
					summary: 'skipped',
				},
				{
					diagnostics: [],
					kind: 'build_output',
					passed: true,
					skipped: false,
					status: 'pass',
					summary: 'ok',
				},
			];
			expect(determinePackageSmokeStatus(checks)).toBe('pass');
		});
	});

	describe('comparePackageSmokeStatus', () => {
		it('compares statuses', () => {
			expect(comparePackageSmokeStatus('blocked', 'pass')).toBeLessThan(0);
			expect(comparePackageSmokeStatus('pass', 'pass')).toBe(0);
			expect(comparePackageSmokeStatus('unknown', 'pass')).toBeGreaterThan(0);
		});
	});

	describe('comparePackageSmokeCheckKind', () => {
		it('compares check kinds', () => {
			expect(
				comparePackageSmokeCheckKind('package_metadata', 'build_output'),
			).toBeLessThan(0);
			expect(comparePackageSmokeCheckKind('build_output', 'build_output')).toBe(
				0,
			);
			expect(
				comparePackageSmokeCheckKind('unknown', 'package_metadata'),
			).toBeGreaterThan(0);
		});
	});
});
