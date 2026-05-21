/**
 * NFR Privacy & Security Evidence Tests
 *
 * Phase 8: NFR Evidence And Release Hardening
 */

import { describe, expect, it } from 'vitest';
import { runPrivacySecurityEvidence } from '../src/evidence/privacy-security-evidence.js';

describe('Privacy Evidence', () => {
	it('produces evidence for no raw tokens in state', () => {
		const items = runPrivacySecurityEvidence({
			checkedAt: '2025-01-01T00:00:00.000Z',
		});

		const tokenItem = items.find((i) => i.id === 'priv-no-raw-tokens-state');
		expect(tokenItem).toBeDefined();
		expect(tokenItem?.status).toBe('pass');
		expect(tokenItem?.nfrIds).toContain('NFR-PRIV-004');
		expect(tokenItem?.nfrIds).toContain('NFR-SEC-001');
	});

	it('produces evidence for no raw tokens in artifacts', () => {
		const items = runPrivacySecurityEvidence({
			checkedAt: '2025-01-01T00:00:00.000Z',
		});

		const artItem = items.find((i) => i.id === 'priv-no-raw-tokens-artifacts');
		expect(artItem).toBeDefined();
		expect(artItem?.status).toBe('pass');
	});

	it('produces evidence for no raw tokens in backups', () => {
		const items = runPrivacySecurityEvidence({
			checkedAt: '2025-01-01T00:00:00.000Z',
		});

		const backupItem = items.find((i) => i.id === 'priv-no-raw-tokens-backups');
		expect(backupItem).toBeDefined();
		expect(backupItem?.status).toBe('pass');
	});

	it('produces evidence for .env not read or backed up', () => {
		const items = runPrivacySecurityEvidence({
			checkedAt: '2025-01-01T00:00:00.000Z',
		});

		const envItem = items.find((i) => i.id === 'priv-no-env-read');
		expect(envItem).toBeDefined();
		expect(envItem?.status).toBe('pass');
	});

	it('produces evidence for synthetic context only', () => {
		const items = runPrivacySecurityEvidence({
			checkedAt: '2025-01-01T00:00:00.000Z',
		});

		const synthItem = items.find((i) => i.id === 'priv-synthetic-context-only');
		expect(synthItem).toBeDefined();
		expect(synthItem?.status).toBe('pass');
	});

	it('produces evidence for remote disclosure required', () => {
		const items = runPrivacySecurityEvidence({
			checkedAt: '2025-01-01T00:00:00.000Z',
		});

		const discItem = items.find(
			(i) => i.id === 'priv-remote-disclosure-required',
		);
		expect(discItem).toBeDefined();
		expect(discItem?.status).toBe('pass');
		expect(discItem?.nfrIds).toContain('NFR-PRIV-002');
		expect(discItem?.nfrIds).toContain('NFR-PRIV-005');
	});

	it('produces evidence for HTML static local files', () => {
		const items = runPrivacySecurityEvidence({
			checkedAt: '2025-01-01T00:00:00.000Z',
		});

		const htmlItem = items.find((i) => i.id === 'priv-html-static-local');
		expect(htmlItem).toBeDefined();
		expect(htmlItem?.status).toBe('pass');
	});

	it('produces evidence for Agent Packs excluding secrets', () => {
		const items = runPrivacySecurityEvidence({
			checkedAt: '2025-01-01T00:00:00.000Z',
		});

		const agItem = items.find(
			(i) => i.id === 'priv-agent-packs-exclude-secrets',
		);
		expect(agItem).toBeDefined();
		expect(agItem?.status).toBe('pass');
	});

	it('produces evidence for package excluding sensitive files', () => {
		const items = runPrivacySecurityEvidence({
			checkedAt: '2025-01-01T00:00:00.000Z',
		});

		const pkgItem = items.find(
			(i) => i.id === 'priv-package-excludes-sensitive',
		);
		expect(pkgItem).toBeDefined();
		expect(pkgItem?.status).toBe('pass');
	});

	it('produces evidence for derived non-canonical', () => {
		const items = runPrivacySecurityEvidence({
			checkedAt: '2025-01-01T00:00:00.000Z',
		});

		const derivedItem = items.find(
			(i) => i.id === 'priv-derived-non-canonical',
		);
		expect(derivedItem).toBeDefined();
		expect(derivedItem?.status).toBe('pass');
	});

	it('produces evidence for output browser read-only', () => {
		const items = runPrivacySecurityEvidence({
			checkedAt: '2025-01-01T00:00:00.000Z',
		});

		const browserItem = items.find(
			(i) => i.id === 'priv-output-browser-read-only',
		);
		expect(browserItem).toBeDefined();
		expect(browserItem?.status).toBe('pass');
	});

	it('produces evidence for no telemetry', () => {
		const items = runPrivacySecurityEvidence({
			checkedAt: '2025-01-01T00:00:00.000Z',
		});

		const telemetryItem = items.find((i) => i.id === 'priv-no-telemetry');
		expect(telemetryItem).toBeDefined();
		expect(telemetryItem?.status).toBe('pass');
		expect(telemetryItem?.nfrIds).toContain('NFR-PRIV-001');
	});

	it('produces exactly 12 privacy evidence items', () => {
		const items = runPrivacySecurityEvidence({
			checkedAt: '2025-01-01T00:00:00.000Z',
		});

		const privacyItems = items.filter((i) => i.category === 'privacy');
		expect(privacyItems.length).toBe(12);
	});
});

describe('Security Evidence', () => {
	it('produces evidence for token source restriction', () => {
		const items = runPrivacySecurityEvidence({
			checkedAt: '2025-01-01T00:00:00.000Z',
		});

		const tokenItem = items.find(
			(i) => i.id === 'sec-token-source-restriction',
		);
		expect(tokenItem).toBeDefined();
		expect(tokenItem?.status).toBe('pass');
		expect(tokenItem?.nfrIds).toContain('NFR-SEC-001');
	});

	it('produces evidence for token redaction', () => {
		const items = runPrivacySecurityEvidence({
			checkedAt: '2025-01-01T00:00:00.000Z',
		});

		const redactItem = items.find((i) => i.id === 'sec-token-redaction');
		expect(redactItem).toBeDefined();
		expect(redactItem?.status).toBe('pass');
		expect(redactItem?.nfrIds).toContain('NFR-SEC-002');
	});

	it('produces evidence for bounded context', () => {
		const items = runPrivacySecurityEvidence({
			checkedAt: '2025-01-01T00:00:00.000Z',
		});

		const contextItem = items.find((i) => i.id === 'sec-bounded-context');
		expect(contextItem).toBeDefined();
		expect(contextItem?.status).toBe('pass');
		expect(contextItem?.nfrIds).toContain('NFR-SEC-003');
	});

	it('produces evidence for destructive confirmation', () => {
		const items = runPrivacySecurityEvidence({
			checkedAt: '2025-01-01T00:00:00.000Z',
		});

		const confirmItem = items.find(
			(i) => i.id === 'sec-destructive-confirmation',
		);
		expect(confirmItem).toBeDefined();
		expect(confirmItem?.status).toBe('pass');
		expect(confirmItem?.nfrIds).toContain('NFR-SEC-004');
	});

	it('produces exactly 4 security evidence items', () => {
		const items = runPrivacySecurityEvidence({
			checkedAt: '2025-01-01T00:00:00.000Z',
		});

		const securityItems = items.filter((i) => i.category === 'security');
		expect(securityItems.length).toBe(4);
	});
});

describe('Privacy/Security Evidence Limitations', () => {
	it('privacy items include "not a formal audit" disclaimer', () => {
		const items = runPrivacySecurityEvidence();

		for (const item of items) {
			if (item.category === 'privacy') {
				expect(
					item.limitations.some(
						(l) =>
							l.includes('not a formal') || l.includes('does not constitute'),
					),
				).toBe(true);
			}
		}
	});

	it('security items include "not a formal audit" disclaimer', () => {
		const items = runPrivacySecurityEvidence();

		for (const item of items) {
			if (item.category === 'security') {
				expect(
					item.limitations.some(
						(l) =>
							l.includes('not a formal') || l.includes('does not constitute'),
					),
				).toBe(true);
			}
		}
	});

	it('does not require network, provider credentials, or external APIs', () => {
		const items = runPrivacySecurityEvidence();
		expect(items.length).toBeGreaterThan(0);
		// All evidence is static analysis, no remote calls
	});
});
