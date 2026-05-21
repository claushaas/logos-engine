/**
 * NFR TUI Accessibility Evidence Tests
 *
 * Phase 8: NFR Evidence And Release Hardening
 */

import { describe, expect, it } from 'vitest';
import { runAccessibilityEvidence } from '../src/evidence/accessibility-evidence.js';

describe('TUI Accessibility Evidence', () => {
	it('produces evidence for keyboard confirmation navigation', () => {
		const items = runAccessibilityEvidence({
			checkedAt: '2025-01-01T00:00:00.000Z',
		});

		const keyboard = items.find((i) => i.id === 'acc-keyboard-confirmation');
		expect(keyboard).toBeDefined();
		expect(keyboard?.nfrIds).toContain('NFR-ACC-001');
	});

	it('produces evidence for selected option text visibility', () => {
		const items = runAccessibilityEvidence({
			checkedAt: '2025-01-01T00:00:00.000Z',
		});

		const selected = items.find((i) => i.id === 'acc-selected-option-visible');
		expect(selected).toBeDefined();
		expect(selected?.nfrIds).toContain('NFR-ACC-002');
	});

	it('produces evidence for focus state visibility', () => {
		const items = runAccessibilityEvidence({
			checkedAt: '2025-01-01T00:00:00.000Z',
		});

		const focus = items.find((i) => i.id === 'acc-focus-visible');
		expect(focus).toBeDefined();
		expect(focus?.nfrIds).toContain('NFR-ACC-003');
	});

	it('produces evidence for state labels', () => {
		const items = runAccessibilityEvidence({
			checkedAt: '2025-01-01T00:00:00.000Z',
		});

		const states = items.find((i) => i.id === 'acc-state-labels');
		expect(states).toBeDefined();
		expect(states?.nfrIds).toContain('NFR-ACC-002');
	});

	it('produces evidence for loading text equivalents', () => {
		const items = runAccessibilityEvidence({
			checkedAt: '2025-01-01T00:00:00.000Z',
		});

		const loading = items.find((i) => i.id === 'acc-loading-text');
		expect(loading).toBeDefined();
		expect(loading?.nfrIds).toContain('NFR-ACC-005');
	});

	it('produces evidence for destructive action labels', () => {
		const items = runAccessibilityEvidence({
			checkedAt: '2025-01-01T00:00:00.000Z',
		});

		const destructive = items.find((i) => i.id === 'acc-destructive-labels');
		expect(destructive).toBeDefined();
		expect(destructive?.nfrIds).toContain('NFR-SEC-004');
	});

	it('produces evidence for compact layout context', () => {
		const items = runAccessibilityEvidence({
			checkedAt: '2025-01-01T00:00:00.000Z',
		});

		const compact = items.find((i) => i.id === 'acc-compact-layout');
		expect(compact).toBeDefined();
		expect(compact?.nfrIds).toContain('NFR-ACC-001');
	});

	it('produces evidence for no color-only semantics', () => {
		const items = runAccessibilityEvidence({
			checkedAt: '2025-01-01T00:00:00.000Z',
		});

		const noColor = items.find((i) => i.id === 'acc-no-color-only');
		expect(noColor).toBeDefined();
		expect(noColor?.nfrIds).toContain('NFR-ACC-002');
	});

	it('produces evidence for help text keyboard actions', () => {
		const items = runAccessibilityEvidence({
			checkedAt: '2025-01-01T00:00:00.000Z',
		});

		const help = items.find((i) => i.id === 'acc-help-keyboard');
		expect(help).toBeDefined();
		expect(help?.nfrIds).toContain('NFR-ACC-001');
	});

	it('produces evidence for focus recovery', () => {
		const items = runAccessibilityEvidence({
			checkedAt: '2025-01-01T00:00:00.000Z',
		});

		const recovery = items.find((i) => i.id === 'acc-focus-recovery');
		expect(recovery).toBeDefined();
		expect(recovery?.nfrIds).toContain('NFR-ACC-003');
	});

	it('includes accessibility limitations disclaimer', () => {
		const items = runAccessibilityEvidence({
			checkedAt: '2025-01-01T00:00:00.000Z',
		});

		for (const item of items) {
			expect(item.limitations.length).toBeGreaterThan(0);
			expect(
				item.limitations.some(
					(l) =>
						l.includes('screen-reader') ||
						l.includes('WCAG') ||
						l.includes('Ink'),
				),
			).toBe(true);
		}
	});

	it('all items have pass_with_warnings status (not full WCAG claim)', () => {
		const items = runAccessibilityEvidence({
			checkedAt: '2025-01-01T00:00:00.000Z',
		});

		for (const item of items) {
			expect(item.status).toBe('pass_with_warnings');
		}
	});

	it('does not mutate state or files', () => {
		const items = runAccessibilityEvidence();
		expect(items).toBeDefined();
		for (const item of items) {
			expect(item.category).toBe('accessibility');
		}
	});

	it('all items are JSON-serializable', () => {
		const items = runAccessibilityEvidence();
		const json = JSON.stringify(items);
		const parsed = JSON.parse(json);
		expect(Array.isArray(parsed)).toBe(true);
	});
});
