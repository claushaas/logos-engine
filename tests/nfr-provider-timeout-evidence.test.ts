/**
 * NFR Provider Timeout Evidence Tests
 *
 * Phase 8: NFR Evidence And Release Hardening
 */

import { describe, expect, it } from 'vitest';
import {
	DEFAULT_AI_PROVIDER_TIMEOUT_MS,
	MAX_AI_PROVIDER_TIMEOUT_MS,
	validateTimeout,
} from '../src/ai/provider-config-model.js';
import { runProviderTimeoutEvidence } from '../src/evidence/provider-timeout-evidence.js';

describe('Provider Timeout Constants', () => {
	it('default timeout is 60 seconds (60000ms)', () => {
		expect(DEFAULT_AI_PROVIDER_TIMEOUT_MS).toBe(60_000);
	});

	it('max timeout is 180 seconds (180000ms)', () => {
		expect(MAX_AI_PROVIDER_TIMEOUT_MS).toBe(180_000);
	});
});

describe('validateTimeout', () => {
	it('rejects invalid timeout values', () => {
		expect(validateTimeout(0).valid).toBe(false);
		expect(validateTimeout(-1).valid).toBe(false);
		expect(validateTimeout(NaN).valid).toBe(false);
		expect(validateTimeout(Infinity).valid).toBe(false);
	});

	it('rejects values exceeding max', () => {
		const result = validateTimeout(200_000);
		expect(result.valid).toBe(false);
		expect(result.diagnostic?.code).toBe('LOGOS_AI_TIMEOUT_TOO_HIGH');
	});

	it('accepts valid timeout values', () => {
		expect(validateTimeout(60_000).valid).toBe(true);
		expect(validateTimeout(90_000).valid).toBe(true);
		expect(validateTimeout(180_000).valid).toBe(true);
		expect(validateTimeout(1).valid).toBe(true);
	});

	it('returns appropriate diagnostic codes', () => {
		const zeroResult = validateTimeout(0);
		expect(zeroResult.diagnostic?.code).toBe('LOGOS_AI_TIMEOUT_INVALID');

		const tooHighResult = validateTimeout(200_000);
		expect(tooHighResult.diagnostic?.code).toBe('LOGOS_AI_TIMEOUT_TOO_HIGH');
	});
});

describe('Provider Timeout Evidence', () => {
	it('produces evidence for default timeout', () => {
		const items = runProviderTimeoutEvidence({
			checkedAt: '2025-01-01T00:00:00.000Z',
		});

		const defaultItem = items.find((i) => i.id === 'provider-timeout-default');
		expect(defaultItem).toBeDefined();
		expect(defaultItem?.status).toBe('pass');
		expect(defaultItem?.nfrIds).toContain('NFR-PERF-002');
	});

	it('produces evidence for max timeout', () => {
		const items = runProviderTimeoutEvidence({
			checkedAt: '2025-01-01T00:00:00.000Z',
		});

		const maxItem = items.find((i) => i.id === 'provider-timeout-max');
		expect(maxItem).toBeDefined();
		expect(maxItem?.status).toBe('pass');
	});

	it('produces evidence for invalid timeout rejection', () => {
		const items = runProviderTimeoutEvidence({
			checkedAt: '2025-01-01T00:00:00.000Z',
		});

		const invalidItem = items.find((i) => i.id === 'provider-timeout-invalid');
		expect(invalidItem).toBeDefined();
		expect(invalidItem?.status).toBe('pass');
		expect(invalidItem?.summary).toContain('6/6');
	});

	it('produces evidence for valid timeout acceptance', () => {
		const items = runProviderTimeoutEvidence({
			checkedAt: '2025-01-01T00:00:00.000Z',
		});

		const validItem = items.find((i) => i.id === 'provider-timeout-valid');
		expect(validItem).toBeDefined();
		expect(validItem?.status).toBe('pass');
	});

	it('produces evidence for state preservation on timeout', () => {
		const items = runProviderTimeoutEvidence();

		const stateItem = items.find(
			(i) => i.id === 'provider-timeout-state-preservation',
		);
		expect(stateItem).toBeDefined();
		expect(stateItem?.status).toBe('pass');
		expect(stateItem?.nfrIds).toContain('NFR-REL-001');
	});

	it('produces evidence for recoverable diagnostics', () => {
		const items = runProviderTimeoutEvidence();

		const diagItem = items.find((i) => i.id === 'provider-timeout-diagnostics');
		expect(diagItem).toBeDefined();
		expect(diagItem?.status).toBe('pass');
	});

	it('produces evidence for no raw token persistence', () => {
		const items = runProviderTimeoutEvidence();

		const tokenItem = items.find(
			(i) => i.id === 'provider-timeout-no-raw-token',
		);
		expect(tokenItem).toBeDefined();
		expect(tokenItem?.status).toBe('pass');
		expect(tokenItem?.nfrIds).toContain('NFR-PRIV-004');
		expect(tokenItem?.nfrIds).toContain('NFR-SEC-001');
	});

	it('does not require network or real provider calls', () => {
		const items = runProviderTimeoutEvidence();
		// All evidence is static analysis
		for (const item of items) {
			expect(item.source.kind).toBe('static_analysis');
		}
	});
});
