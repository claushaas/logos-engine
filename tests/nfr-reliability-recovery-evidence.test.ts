/**
 * NFR Reliability & Recovery Evidence Tests
 *
 * Phase 8: NFR Evidence And Release Hardening
 */

import { describe, expect, it } from 'vitest';
import { runReliabilityRecoveryEvidence } from '../src/evidence/reliability-recovery-evidence.js';

describe('Reliability & Recovery Evidence', () => {
	it('produces evidence for provider unavailable', () => {
		const items = runReliabilityRecoveryEvidence({
			checkedAt: '2025-01-01T00:00:00.000Z',
		});

		const unavailable = items.find((i) => i.id === 'rel-provider-unavailable');
		expect(unavailable).toBeDefined();
		expect(unavailable?.status).toBe('pass');
		expect(unavailable?.nfrIds).toContain('NFR-REL-001');
		expect(unavailable?.nfrIds).toContain('NFR-AVA-002');
	});

	it('produces evidence for provider timeout', () => {
		const items = runReliabilityRecoveryEvidence({
			checkedAt: '2025-01-01T00:00:00.000Z',
		});

		const timeout = items.find((i) => i.id === 'rel-provider-timeout');
		expect(timeout).toBeDefined();
		expect(timeout?.status).toBe('pass');
		expect(timeout?.nfrIds).toContain('NFR-REL-001');
	});

	it('produces evidence for provider disclosure blocked', () => {
		const items = runReliabilityRecoveryEvidence({
			checkedAt: '2025-01-01T00:00:00.000Z',
		});

		const disclosure = items.find(
			(i) => i.id === 'rel-provider-disclosure-blocked',
		);
		expect(disclosure).toBeDefined();
		expect(disclosure?.status).toBe('pass');
		expect(disclosure?.nfrIds).toContain('NFR-PRIV-002');
	});

	it('produces evidence for generation partial failure', () => {
		const items = runReliabilityRecoveryEvidence({
			checkedAt: '2025-01-01T00:00:00.000Z',
		});

		const genPartial = items.find(
			(i) => i.id === 'rel-generation-partial-failure',
		);
		expect(genPartial).toBeDefined();
		expect(genPartial?.status).toBe('pass');
		expect(genPartial?.nfrIds).toContain('NFR-REL-005');
	});

	it('produces evidence for derived artifact failure', () => {
		const items = runReliabilityRecoveryEvidence({
			checkedAt: '2025-01-01T00:00:00.000Z',
		});

		const derivedFail = items.find(
			(i) => i.id === 'rel-derived-artifact-failure',
		);
		expect(derivedFail).toBeDefined();
		expect(derivedFail?.status).toBe('pass');
	});

	it('produces evidence for validation blocked', () => {
		const items = runReliabilityRecoveryEvidence({
			checkedAt: '2025-01-01T00:00:00.000Z',
		});

		const valBlocked = items.find((i) => i.id === 'rel-validation-blocked');
		expect(valBlocked).toBeDefined();
		expect(valBlocked?.status).toBe('pass');
		expect(valBlocked?.nfrIds).toContain('NFR-REL-006');
	});

	it('produces evidence for executive readiness blocked', () => {
		const items = runReliabilityRecoveryEvidence({
			checkedAt: '2025-01-01T00:00:00.000Z',
		});

		const execBlocked = items.find(
			(i) => i.id === 'rel-executive-readiness-blocked',
		);
		expect(execBlocked).toBeDefined();
		expect(execBlocked?.status).toBe('pass');
	});

	it('produces evidence for migration backup failure', () => {
		const items = runReliabilityRecoveryEvidence({
			checkedAt: '2025-01-01T00:00:00.000Z',
		});

		const migrationFail = items.find(
			(i) => i.id === 'rel-migration-backup-failure',
		);
		expect(migrationFail).toBeDefined();
		expect(migrationFail?.status).toBe('pass');
		expect(migrationFail?.nfrIds).toContain('NFR-REL-003');
	});

	it('produces evidence for restore unsafe path', () => {
		const items = runReliabilityRecoveryEvidence({
			checkedAt: '2025-01-01T00:00:00.000Z',
		});

		const restoreUnsafe = items.find((i) => i.id === 'rel-restore-unsafe-path');
		expect(restoreUnsafe).toBeDefined();
		expect(restoreUnsafe?.status).toBe('pass');
		expect(restoreUnsafe?.nfrIds).toContain('NFR-REL-004');
	});

	it('produces evidence for root invalid path', () => {
		const items = runReliabilityRecoveryEvidence({
			checkedAt: '2025-01-01T00:00:00.000Z',
		});

		const rootInvalid = items.find((i) => i.id === 'rel-root-invalid-path');
		expect(rootInvalid).toBeDefined();
		expect(rootInvalid?.status).toBe('pass');
	});

	it('produces evidence for output unknown artifact', () => {
		const items = runReliabilityRecoveryEvidence({
			checkedAt: '2025-01-01T00:00:00.000Z',
		});

		const unknownArt = items.find(
			(i) => i.id === 'rel-output-unknown-artifact',
		);
		expect(unknownArt).toBeDefined();
		expect(unknownArt?.status).toBe('pass');
	});

	it('produces evidence for package smoke missing profile', () => {
		const items = runReliabilityRecoveryEvidence({
			checkedAt: '2025-01-01T00:00:00.000Z',
		});

		const smokeMissing = items.find(
			(i) => i.id === 'rel-package-smoke-missing-profile',
		);
		expect(smokeMissing).toBeDefined();
		expect(smokeMissing?.status).toBe('pass');
		expect(smokeMissing?.nfrIds).toContain('NFR-OPS-002');
	});

	it('produces evidence for cancel/no confirmation non-mutation', () => {
		const items = runReliabilityRecoveryEvidence({
			checkedAt: '2025-01-01T00:00:00.000Z',
		});

		const cancel = items.find((i) => i.id === 'rel-cancel-no-mutation');
		expect(cancel).toBeDefined();
		expect(cancel?.status).toBe('pass');
		expect(cancel?.nfrIds).toContain('NFR-SEC-004');
	});

	it('produces evidence for dry-run non-mutation', () => {
		const items = runReliabilityRecoveryEvidence({
			checkedAt: '2025-01-01T00:00:00.000Z',
		});

		const dryRun = items.find((i) => i.id === 'rel-dry-run-mutation');
		expect(dryRun).toBeDefined();
		expect(dryRun?.status).toBe('pass');
	});

	it('covers all 14 reliability scenarios', () => {
		const items = runReliabilityRecoveryEvidence({
			checkedAt: '2025-01-01T00:00:00.000Z',
		});

		expect(items.length).toBe(14);

		// All items should have pass status
		for (const item of items) {
			expect(item.status).toBe('pass');
		}
	});

	it('all items reference source file', () => {
		const items = runReliabilityRecoveryEvidence();

		for (const item of items) {
			expect(item.source.file).toBeTruthy();
		}
	});
});
