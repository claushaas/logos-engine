/**
 * Tests for date utilities: `nowIso`, `toIsoString`, `parseIsoDate`.
 */
import { describe, expect, it } from 'vitest';
import { nowIso, parseIsoDate, toIsoString } from '../../src/shared/index.js';

describe('date utilities', () => {
	describe('nowIso', () => {
		it('returns an ISO 8601 string ending with Z', () => {
			const iso = nowIso();
			expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
		});

		it('produces a date close to the current time', () => {
			const before = Date.now();
			const iso = nowIso();
			const after = Date.now();
			const parsed = new Date(iso).getTime();
			expect(parsed).toBeGreaterThanOrEqual(before - 100);
			expect(parsed).toBeLessThanOrEqual(after + 100);
		});
	});

	describe('toIsoString', () => {
		it('converts a Date object to ISO string', () => {
			const date = new Date('2024-01-15T10:30:00.000Z');
			expect(toIsoString(date)).toBe('2024-01-15T10:30:00.000Z');
		});

		it('converts a numeric timestamp to ISO string', () => {
			const ts = new Date('2024-01-15T10:30:00.000Z').getTime();
			expect(toIsoString(ts)).toBe('2024-01-15T10:30:00.000Z');
		});

		it('converts an ISO string to ISO string (pass-through)', () => {
			expect(toIsoString('2024-06-01T12:00:00.000Z')).toBe(
				'2024-06-01T12:00:00.000Z',
			);
		});
	});

	describe('parseIsoDate', () => {
		it('parses a valid ISO string into a Date', () => {
			const result = parseIsoDate('2024-01-15T10:30:00.000Z');
			expect(result).toBeInstanceOf(Date);
			expect(result?.toISOString()).toBe('2024-01-15T10:30:00.000Z');
		});

		it('returns null for invalid ISO strings', () => {
			expect(parseIsoDate('not-a-date')).toBeNull();
			expect(parseIsoDate('')).toBeNull();
		});
	});
});
