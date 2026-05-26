/**
 * Tests for `generateId()` — uniqueness, sortability, and format.
 */
import { describe, expect, it, beforeEach } from 'vitest';
import { generateId } from '../../src/shared/index.js';
import { _resetIdCounter } from '../../src/shared/utils/id.js';

describe('generateId', () => {
	beforeEach(() => {
		_resetIdCounter();
	});

	it('returns a non-empty string', () => {
		const id = generateId();
		expect(id).toBeTruthy();
		expect(typeof id).toBe('string');
	});

	it('produces unique IDs across many generations', () => {
		const ids = new Set<string>();
		for (let i = 0; i < 10000; i++) {
			const id = generateId();
			expect(ids.has(id)).toBe(false);
			ids.add(id);
		}
		expect(ids.size).toBe(10000);
	});

	it('produces lexicographically sortable IDs matching generation order', () => {
		const ids: string[] = [];
		for (let i = 0; i < 1000; i++) {
			ids.push(generateId());
		}

		const sorted = [...ids].sort();
		expect(sorted).toEqual(ids);
	});

	it('has the expected format: timestamp_counter_entropy', () => {
		const id = generateId();
		// Format: 15-digit ts, underscore, 6-digit counter, underscore, 8 hex chars
		expect(id).toMatch(/^\d{15}_\d{6}_[0-9a-f]{8}$/);
	});

	it('increments the counter within the same millisecond', () => {
		// The counter should increment for rapid calls within the same timestamp.
		const id1 = generateId();
		const id2 = generateId();

		const counter1 = Number.parseInt(id1.split('_')[1]!, 10);
		const counter2 = Number.parseInt(id2.split('_')[1]!, 10);

		// If they share the same timestamp, counter2 > counter1.
		// If they don't (rare), counter2 could be 0. Both are valid.
		if (id1.slice(0, 15) === id2.slice(0, 15)) {
			expect(counter2).toBe(counter1 + 1);
		}
	});

	it('sorts lexicographically by time due to prepended timestamp', () => {
		const id1 = generateId();
		// Small delay to ensure different timestamp
		const id2 = generateId();

		// IDs should sort by their string representation.
		// Since timestamps are leftmost and always increasing,
		// id1 should sort before id2 (or equal if same ms).
		expect(id1 <= id2).toBe(true);
	});
});
